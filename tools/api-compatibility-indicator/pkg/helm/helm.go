package helm

import (
	gomodules "api-compatibility/pkg/go-modules"
	"api-compatibility/pkg/util"
	"context"
	"fmt"
	"log/slog"
	"slices"

	"github.com/Masterminds/semver/v3"
	"github.com/urfave/cli/v3"
)

const (
	kubernetesDep = "k8s.io/apimachinery"
)

func CompatibilityRange(ctx context.Context, log *slog.Logger, cmd *cli.Command) error {
	versions, err := gomodules.GetModuleVersions(ctx, kubernetesDep)
	if err != nil {
		return fmt.Errorf("error getting versions: %w", err)
	}

	var (
		allVersions  []*semver.Version
		latestMinors []*semver.Version
	)

	smallerThan0_30, err := semver.NewConstraint("< 0.34")
	if err != nil {
		return err
	}

	for _, vStr := range versions {
		v, err := semver.NewVersion(vStr)
		if err != nil {
			continue
		}

		if smallerThan0_30.Check(v) {
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
		if i+1 == len(allVersions) {
			break
		}

		if allVersions[i].Minor() != allVersions[i+1].Minor() {
			latestMinors = append(latestMinors, allVersions[i])
		}
	}

	for _, v := range latestMinors {
		v = semver.New(1, v.Minor(), v.Patch(), v.Prerelease(), v.Metadata()) // kubernetes has version 1 but uses modules versions with 0

		log.Info("checking helm chart against k8s version", "version", v.String())

		err = util.ExecuteCmd(ctx, ".", "sh", "-c", fmt.Sprintf("helm template %s | kubeconform --kubernetes-version %s --summary --output json", cmd.String("chart-oci-path"), v.String()))
		if err != nil {
			return err
		}
	}

	return nil
}
