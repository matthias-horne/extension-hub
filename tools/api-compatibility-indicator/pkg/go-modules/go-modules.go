package gomodules

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os/exec"
	"strings"
	"time"

	"github.com/Masterminds/semver/v3"
	"golang.org/x/mod/modfile"
)

func GetModuleVersions(ctx context.Context, module string) ([]string, error) {
	out, err := exec.CommandContext(ctx, "go", "list", "-m", "-versions", module).Output()
	if err != nil {
		return nil, err
	}

	parts := strings.Fields(string(out))
	if len(parts) <= 1 {
		return nil, fmt.Errorf("no versions found for module %s", module)
	}

	return parts[1:], nil
}

func FindDependencyVersion(log *slog.Logger, file *modfile.File, dependencyName string) (*semver.Version, error) {
	var (
		version *semver.Version
		err     error
	)

	for _, req := range file.Require {
		if req.Mod.Path == dependencyName {
			version, err = semver.NewVersion(req.Mod.Version)
			if err != nil {
				return nil, fmt.Errorf("unable to parse kubernetes dependency version: %w", err)
			}
		}
	}

	for _, req := range file.Replace {
		if req.Old.Path == dependencyName {
			if req.New.Path != dependencyName {
				return nil, fmt.Errorf("using own kubernetes dependency, unable to figure out compatibility")
			}

			log.Warn("dependency is replaced in go.mod file", "name", req.Old.Path, "old-version", req.Old.Version, "new-version", req.New.Version)

			version, err = semver.NewVersion(req.New.Version)
			if err != nil {
				return nil, fmt.Errorf("unable to parse kubernetes dependency version: %w", err)
			}
		}
	}

	if version == nil {
		return nil, fmt.Errorf("dependency %s not found in the go.mod file", dependencyName)
	}

	return version, nil
}

func DownloadAndGetModuleWithVersion(module, version string) (string, error) {
	return DownloadAndGetModuleDir(fmt.Sprintf("%s@v%s", module, version))
}

func DownloadAndGetModuleDir(module string) (string, error) {
	var (
		ctx, cancel = context.WithTimeout(context.Background(), 10*time.Minute)
	)

	defer cancel()

	// Explicit versions work outside a module and reuse Go's shared module cache.
	if !strings.Contains(module, "@") {
		module += "@latest"
	}
	cmd := exec.CommandContext(ctx, "go", "mod", "download", "-json", module)
	var stderr strings.Builder
	cmd.Stderr = &stderr
	out, downloadErr := cmd.Output()
	var m struct {
		Dir   string `json:"Dir"`
		Error string `json:"Error"`
	}
	parseErr := json.Unmarshal(out, &m)
	if downloadErr != nil {
		detail := stderr.String()
		if m.Error != "" {
			detail = m.Error
		}
		return "", fmt.Errorf("failed to download %s: %w (%s)", module, downloadErr, detail)
	}
	if parseErr != nil {
		return "", fmt.Errorf("failed to unmarshal module json: %w", parseErr)
	}
	if m.Dir == "" {
		return "", fmt.Errorf("could not find Dir field in JSON")
	}

	return m.Dir, nil
}
