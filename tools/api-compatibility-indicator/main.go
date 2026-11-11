package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"go/types"
	"io"
	"io/fs"
	"log/slog"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"golang.org/x/mod/modfile"
	"golang.org/x/tools/go/packages"
	"k8s.io/apimachinery/pkg/util/yaml"

	"github.com/Masterminds/semver/v3"
	"github.com/google/go-cmp/cmp"
)

const (
	extensionPathEnvVar = "EXTENSION_PATH"
	additionalTypesEnv  = "ADDITIONAL_TYPES"

	gardenerDep   = "github.com/gardener/gardener/pkg/apis"
	kubernetesDep = "k8s.io/apimachinery"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{}))

	if err := run(log); err != nil {
		log.Error("unable to run compatibility check", "error", err)
		os.Exit(1)
	}
}

func run(log *slog.Logger) error {

	extensionPath := os.Getenv(extensionPathEnvVar)
	if extensionPath == "" {
		return fmt.Errorf("need to provide EXTENSION_PATH env var")
	}

	extBaseDir, err := downloadAndGetModuleDir(extensionPath)
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

	gardenerVersion, err := findDependencyVersion(log, file, gardenerDep)
	if err != nil {
		return err
	}

	kubernetesVersion, err := findDependencyVersion(log, file, kubernetesDep)
	if err != nil {
		return err
	}

	log.Info("figured out extension's dependency versions", "extension", extensionPath, gardenerDep, gardenerVersion.String(), kubernetesDep, kubernetesVersion.String())

	reconciledResources, err := readControllerRegistrationResources(extBaseDir)
	if err != nil {
		return err
	}

	var (
		additionalTypes    []string
		additionalVersions []string
	)

	if types := os.Getenv(additionalTypesEnv); types != "" {
		for entry := range strings.SplitSeq(types, ",") {
			pkgPath, typeName, found := strings.Cut(entry, ".")
			if !found {
				return fmt.Errorf("invalid %s format, expected package/version.TypeName, found: %q", additionalTypesEnv, entry)
			}

			additionalTypes = append(additionalTypes, typeName)

			pathParts := strings.Split(pkgPath, "/")
			version := pathParts[len(pathParts)-1]

			additionalVersions = append(additionalVersions, version)
		}
	}

	log.Info("gathered resources to look at", "resources", strings.Join(append(reconciledResources, additionalTypes...), ","))

	return findLowerAndUpperBound(log, gardenerVersion, append([]string{"extensions/v1alpha1"}, additionalTypes...), append(reconciledResources, additionalTypes...))
}

func readControllerRegistrationResources(extBaseDir string) ([]string, error) {
	var resources []string

	f, err := os.OpenFile(path.Join(extBaseDir, "example", "controller-registration.yaml"), os.O_RDONLY, os.ModePerm)
	if err != nil {
		return nil, fmt.Errorf("error to open controller-registration.yaml: %w", err)
	}

	decoder := yaml.NewYAMLOrJSONDecoder(f, 4096)

	for {
		type controllerRegistration struct {
			Kind string `json:"kind"`
			Spec struct {
				Resources []struct {
					Kind string `json:"kind"`
				} `json:"resources"`
			} `json:"spec"`
		}

		var res controllerRegistration

		err := decoder.Decode(&res)
		if errors.Is(err, io.EOF) {
			break
		}

		if res.Kind == "ControllerRegistration" {
			for _, resourceKind := range res.Spec.Resources {
				resources = append(resources, resourceKind.Kind)
			}
		}
	}

	return resources, nil
}

func findDependencyVersion(log *slog.Logger, file *modfile.File, dependencyName string) (*semver.Version, error) {
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

func getModuleVersions(ctx context.Context, module string) ([]string, error) {
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

func downloadAndGetModuleWithVersion(module, version string) (string, error) {
	return downloadAndGetModuleDir(fmt.Sprintf("%s@v%s", module, version))
}

func downloadAndGetModuleDir(module string) (string, error) {
	var (
		ctx, cancel = context.WithTimeout(context.Background(), 10*time.Minute)
	)

	defer cancel()

	cmd := exec.CommandContext(ctx, "go", "mod", "download", module)
	var stderr strings.Builder
	cmd.Stderr = &stderr
	err := cmd.Run()
	if err != nil {
		return "", fmt.Errorf("failed to download %s: %w (stderr: %s)", module, err, stderr.String())
	}

	out, err := exec.CommandContext(ctx, "go", "list", "-m", "-json", module).Output()
	if err != nil {
		return "", fmt.Errorf("failed to list module %s: %w", module, err)
	}

	var m struct {
		Dir string `json:"Dir"`
	}

	if err := json.Unmarshal([]byte(out), &m); err != nil {
		return "", fmt.Errorf("failed to unmarshal module json: %w", err)
	}
	if m.Dir == "" {
		return "", fmt.Errorf("could not find Dir field in JSON")
	}

	return m.Dir, nil
}

func executeCmd(ctx context.Context, dir string, name string, args ...string) error {
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Dir = dir
	return cmd.Run()
}

func findLowerAndUpperBound(log *slog.Logger, gardenerVersion *semver.Version, apis []string, resources []string) error {
	var (
		ctx, cancel  = context.WithTimeout(context.Background(), 10*time.Minute)
		allVersions  []*semver.Version
		latestMinors []*semver.Version
	)

	defer cancel()

	extBaseDir, err := downloadAndGetModuleWithVersion(gardenerDep, gardenerVersion.String())
	if err != nil {
		return fmt.Errorf("error getting module dir for base version %s: %w", gardenerVersion.String(), err)
	}

	baseDefinition, err := extractApiDefinition(extBaseDir, apis, resources)
	if err != nil {
		return fmt.Errorf("error extracting definition for base version %s: %w", gardenerVersion.String(), err)
	}

	log.Info("api definitions extracted", "version", gardenerVersion.String())

	versions, err := getModuleVersions(ctx, gardenerDep)
	if err != nil {
		return fmt.Errorf("error getting versions: %w", err)
	}

	for _, vStr := range versions {
		v, err := semver.NewVersion(vStr)
		if err != nil {
			continue
		}

		allVersions = append(allVersions, v)
	}

	slices.SortFunc(allVersions, func(a, b *semver.Version) int {
		return a.Compare(b)
	})

	for i := range allVersions {
		if allVersions[i].Equal(gardenerVersion) {
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
		return ver.Equal(gardenerVersion)
	})

	if currentIdx == -1 {
		return fmt.Errorf("could not find version for gardener version %s", gardenerVersion.String())
	}

	upperBoundIdx := currentIdx
	for i := currentIdx + 1; i < len(latestMinors); i++ {
		versionStr := latestMinors[i].String()
		log.Info("checking version (up)", "version", versionStr)

		dir, err := downloadAndGetModuleWithVersion(gardenerDep, versionStr)
		if err != nil {
			log.Warn("failed to get module dir, skipping", "version", versionStr, "error", err)
			continue
		}

		definition, err := extractApiDefinition(dir, apis, resources)
		if err != nil {
			log.Warn("error extracting definition, skipping", "version", versionStr, "error", err)
			continue
		}

		if diff := cmp.Diff(baseDefinition, definition); diff != "" {
			log.Info("detected API change (up)")
			fmt.Println(diff)
			break
		}

		upperBoundIdx = i
	}

	lowerBoundIdx := currentIdx
	for i := currentIdx - 1; i >= 0; i-- {
		versionStr := latestMinors[i].String()
		log.Info("checking version (down)", "version", versionStr)

		dir, err := downloadAndGetModuleWithVersion(gardenerDep, versionStr)
		if err != nil {
			log.Warn("failed to get module dir, skipping", "version", versionStr, "error", err)
			continue
		}

		definition, err := extractApiDefinition(dir, apis, resources)
		if err != nil {
			log.Warn("error extracting definition, skipping", "version", versionStr, "error", err)
			continue
		}

		if diff := cmp.Diff(baseDefinition, definition); diff != "" {
			log.Info("detected API change (down)")
			fmt.Println(diff)
			break
		}
		lowerBoundIdx = i
	}

	log.Info("API compatibility range",
		"start", latestMinors[lowerBoundIdx].String(),
		"end", latestMinors[upperBoundIdx].String(),
		"current", gardenerVersion.String(),
	)

	return nil
}

func extractApiDefinition(dir string, apiFolders []string, resources []string) (map[string]map[string]string, error) {
	var apis []string

	err := filepath.WalkDir(filepath.Join(dir), func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if d.IsDir() && slices.ContainsFunc(apiFolders, func(version string) bool {
			return strings.HasSuffix(path, version)
		}) {
			apis = append(apis, path)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	definitions := make(map[string]map[string]string)

	for _, api := range apis {
		pkgs, err := packages.Load(&packages.Config{
			Mode: packages.NeedName | packages.NeedTypes | packages.NeedSyntax | packages.NeedTypesInfo | packages.NeedImports,
			Dir:  api,
		})
		if err != nil {
			return nil, err
		}

		for _, pkg := range pkgs {
			scope := pkg.Types.Scope()
			for _, name := range scope.Names() {
				obj := scope.Lookup(name)
				typeName, ok := obj.(*types.TypeName)
				if !ok {
					continue
				}

				if !slices.Contains(resources, name) {
					continue
				}

				collector := &typeCollector{
					visited: make(map[types.Type]bool),
					fields:  make(map[string]string),
				}

				collector.collect(typeName.Type(), pkg.PkgPath+"/"+name)
				definitions[pkg.Types.Path()] = collector.fields
			}
		}
	}

	return definitions, nil
}

type typeCollector struct {
	visited map[types.Type]bool
	fields  map[string]string
}

func (c *typeCollector) collect(t types.Type, prefix string) {
	for {
		if ptr, ok := t.(*types.Pointer); ok {
			t = ptr.Elem()
			continue
		}
		if named, ok := t.(*types.Named); ok {
			t = named.Underlying()
			continue
		}
		if s, ok := t.(*types.Slice); ok {
			t = s.Elem()
			continue
		}
		if a, ok := t.(*types.Array); ok {
			t = a.Elem()
			continue
		}
		if m, ok := t.(*types.Map); ok {
			t = m.Elem()
			continue
		}
		break
	}

	if s, ok := t.(*types.Struct); ok {
		if c.visited[s] {
			return
		}
		c.visited[s] = true

		for field := range s.Fields() {
			fieldName := field.Name()
			if prefix != "" {
				fieldName = prefix + "." + fieldName
			}

			c.fields[fieldName] = field.Type().String()
			c.collect(field.Type(), fieldName)
		}
	}
}
