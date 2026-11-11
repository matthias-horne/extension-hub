package helm

import (
	"api-compatibility/pkg/api"
	gomodules "api-compatibility/pkg/go-modules"
	"api-compatibility/pkg/util"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"path"
	"slices"
	"strings"

	"github.com/Masterminds/semver/v3"
	"github.com/urfave/cli/v3"
	"golang.org/x/mod/modfile"
)

const (
	kubernetesDep = "k8s.io/apimachinery"
)

func CompatibilityRange(ctx context.Context, log *slog.Logger, cmd *cli.Command) error {
	extBaseDir, err := gomodules.DownloadAndGetModuleDir(cmd.String("extension-path"))
	if err != nil {
		return fmt.Errorf("error getting module dir: %w", err)
	}

	data, err := os.ReadFile(path.Join(extBaseDir, "go.mod"))
	if err != nil {
		return fmt.Errorf("error to open go.mod: %w", err)
	}

	file, err := modfile.Parse("go.mod", data, nil)
	if err != nil {
		return fmt.Errorf("error parsing go.mod: %w", err)
	}

	log.Info("parsed go mod file", "module", file.Module.Mod.Path, "go-version", file.Go.Version)

	kubernetesVersion, err := gomodules.FindDependencyVersion(log, file, kubernetesDep)
	if err != nil {
		return err
	}

	log.Info("figured out extension's dependency versions", "extension", cmd.String("extension-path"), kubernetesDep, kubernetesVersion.String())

	versions, err := gomodules.GetModuleVersions(ctx, kubernetesDep)
	if err != nil {
		return fmt.Errorf("error getting versions: %w", err)
	}

	var (
		allVersions  []*semver.Version
		latestMinors []*semver.Version
	)

	smallerThan0_34, err := semver.NewConstraint("< 0.34")
	if err != nil {
		return err
	}

	for _, vStr := range versions {
		v, err := semver.NewVersion(vStr)
		if err != nil {
			continue
		}

		if smallerThan0_34.Check(v) {
			continue
		}

		if v.Prerelease() != "" {
			continue
		}

		allVersions = append(allVersions, v)
	}

	slices.SortFunc(allVersions, func(a, b *semver.Version) int {
		return a.Compare(b)
	})

	for i := range allVersions {
		if allVersions[i].Equal(kubernetesVersion) {
			latestMinors = append(latestMinors, allVersions[i])
			continue
		}

		if i+1 == len(allVersions) {
			break
		}

		if allVersions[i].Minor() != allVersions[i+1].Minor() {
			latestMinors = append(latestMinors, allVersions[i])
		}
	}

	currentIdx := slices.IndexFunc(latestMinors, func(ver *semver.Version) bool {
		return ver.Equal(kubernetesVersion)
	})

	if currentIdx == -1 {
		return fmt.Errorf("could not find version for kubernetes version %s", kubernetesVersion.String())
	}

	var breakingLower []string
	var breakingHigher []string

	upperBoundIdx := currentIdx
	for i := currentIdx + 1; i < len(latestMinors); i++ {
		versionStr := latestMinors[i].String()
		log.Info("checking helm chart against k8s version (up)", "version", versionStr)

		vCmp := toCmpVersion(latestMinors[i])
		if err := runKubeconform(ctx, cmd.String("chart-oci-path"), vCmp.String()); err != nil {
			breakingHigher = append(breakingHigher, fmt.Sprintf("k8s %s: %v", vCmp.String(), err))
			break
		}
		upperBoundIdx = i
	}

	lowerBoundIdx := currentIdx
	for i := currentIdx - 1; i >= 0; i-- {
		versionStr := latestMinors[i].String()
		log.Info("checking helm chart against k8s version (down)", "version", versionStr)

		vCmp := toCmpVersion(latestMinors[i])
		if err := runKubeconform(ctx, cmd.String("chart-oci-path"), vCmp.String()); err != nil {
			breakingLower = append(breakingLower, fmt.Sprintf("k8s %s: %v", vCmp.String(), err))
			break
		}
		lowerBoundIdx = i
	}

	res, err := json.MarshalIndent(api.CompatibilityRange{
		Version:          kubernetesVersion.String(),
		From:             latestMinors[lowerBoundIdx].String(),
		To:               latestMinors[upperBoundIdx].String(),
		BreakingOnLower:  breakingLower,
		BreakingOnHigher: breakingHigher,
	}, "", "    ")
	if err != nil {
		return err
	}

	fmt.Println(string(res))

	return nil
}

func toCmpVersion(v *semver.Version) *semver.Version {
	return semver.New(1, v.Minor(), v.Patch(), v.Prerelease(), v.Metadata())
}

func runKubeconform(ctx context.Context, chartPath, k8sVersion string) error {
	cmdStr := fmt.Sprintf("helm template %s | kubeconform --kubernetes-version %s --summary --output json", chartPath, k8sVersion)
	output, err := util.ExecuteCmdWithOutput(ctx, ".", "sh", "-c", cmdStr)
	if err != nil {
		return fmt.Errorf("%s", strings.TrimSpace(string(output)))
	}
	return nil
}
