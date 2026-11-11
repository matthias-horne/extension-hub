package gardener

import (
	"api-compatibility/pkg/api"
	gomodules "api-compatibility/pkg/go-modules"
	"context"
	"encoding/json"
	"fmt"
	"go/types"
	"io/fs"
	"log/slog"
	"maps"
	"os"
	"path"
	"path/filepath"
	"slices"
	"strings"

	"github.com/Masterminds/semver/v3"
	"github.com/google/go-cmp/cmp"
	"github.com/urfave/cli/v3"
	"golang.org/x/mod/modfile"
	"golang.org/x/tools/go/packages"
)

const (
	gardenerDep   = "github.com/gardener/gardener/pkg/apis"
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

	gardenerVersion, err := gomodules.FindDependencyVersion(log, file, gardenerDep)
	if err != nil {
		return err
	}

	kubernetesVersion, err := gomodules.FindDependencyVersion(log, file, kubernetesDep)
	if err != nil {
		return err
	}

	log.Info("figured out extension's dependency versions", "extension", cmd.String("extension-path"), gardenerDep, gardenerVersion.String(), kubernetesDep, kubernetesVersion.String())

	reconciledResources, err := readControllerRegistrationResources(extBaseDir)
	if err != nil {
		return err
	}

	var (
		additionalTypes    []string
		additionalVersions []string
	)

	for _, entry := range cmd.StringSlice("additional-types") {
		pkgPath, typeName, found := strings.Cut(entry, ".")
		if !found {
			return fmt.Errorf("invalid format for additional type, expected package/version.TypeName, found: %q", entry)
		}

		additionalTypes = append(additionalTypes, typeName)

		pathParts := strings.Split(pkgPath, "/")
		version := pathParts[len(pathParts)-1]

		additionalVersions = append(additionalVersions, version)
	}

	log.Info("gathered resources to look at", "resources", strings.Join(append(reconciledResources, additionalTypes...), ","))

	return findLowerAndUpperBound(ctx, log, gardenerVersion, append([]string{"extensions/v1alpha1"}, additionalTypes...), append(reconciledResources, additionalTypes...))
}

func findLowerAndUpperBound(ctx context.Context, log *slog.Logger, gardenerVersion *semver.Version, apis []string, resources []string) error {
	var (
		allVersions  []*semver.Version
		latestMinors []*semver.Version
	)

	extBaseDir, err := gomodules.DownloadAndGetModuleWithVersion(gardenerDep, gardenerVersion.String())
	if err != nil {
		return fmt.Errorf("error getting module dir for base version %s: %w", gardenerVersion.String(), err)
	}

	baseDefinition, err := extractApiDefinition(extBaseDir, apis, resources)
	if err != nil {
		return fmt.Errorf("error extracting definition for base version %s: %w", gardenerVersion.String(), err)
	}

	log.Info("api definitions extracted", "version", gardenerVersion.String())

	versions, err := gomodules.GetModuleVersions(ctx, gardenerDep)
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

	var (
		breakingLower  []string
		breakingHigher []string
	)

	upperBoundIdx := currentIdx
	for i := currentIdx + 1; i < len(latestMinors); i++ {
		versionStr := latestMinors[i].String()
		log.Info("checking version (up)", "version", versionStr)

		dir, err := gomodules.DownloadAndGetModuleWithVersion(gardenerDep, versionStr)
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
			log.Info(diff)
			breakingHigher = getBreakingChanges(baseDefinition, definition, versionStr)
			break
		}

		upperBoundIdx = i
	}

	lowerBoundIdx := currentIdx
	for i := currentIdx - 1; i >= 0; i-- {
		versionStr := latestMinors[i].String()
		log.Info("checking version (down)", "version", versionStr)

		dir, err := gomodules.DownloadAndGetModuleWithVersion(gardenerDep, versionStr)
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
			log.Info(diff)
			breakingLower = getBreakingChanges(baseDefinition, definition, versionStr)
			break
		}
		lowerBoundIdx = i
	}

	res, err := json.MarshalIndent(api.CompatibilityRange{
		Version:          gardenerVersion.String(),
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

func extractApiDefinition(dir string, apiFolders []string, resources []string) (map[string]string, error) {
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

	definitions := make(map[string]string)

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
				maps.Copy(definitions, collector.fields)
			}
		}
	}

	return definitions, nil
}

func getBreakingChanges(base, current map[string]string, version string) []string {
	var changes []string

	type resourceChange struct {
		removed []string
		changed []string
	}

	resourceChanges := make(map[string]*resourceChange)

	for f, t := range base {
		currType, exists := current[f]
		if !exists {
			resource := getResourceName(f)
			if _, ok := resourceChanges[resource]; !ok {
				resourceChanges[resource] = &resourceChange{}
			}
			resourceChanges[resource].removed = append(resourceChanges[resource].removed, getRelativeField(f))
		} else if currType != t {
			resource := getResourceName(f)
			if _, ok := resourceChanges[resource]; !ok {
				resourceChanges[resource] = &resourceChange{}
			}
			resourceChanges[resource].changed = append(resourceChanges[resource].changed, fmt.Sprintf("%s: %s -> %s", getRelativeField(f), t, currType))
		}
	}

	for resource, ch := range resourceChanges {
		if len(ch.removed) > 0 {
			slices.Sort(ch.removed)
			changes = append(changes, fmt.Sprintf("%s removes fields %s from %s", version, strings.Join(ch.removed, ", "), resource))
		}
		if len(ch.changed) > 0 {
			slices.Sort(ch.changed)
			changes = append(changes, fmt.Sprintf("%s changes fields in %s: %s", version, resource, strings.Join(ch.changed, ", ")))
		}
	}
	slices.Sort(changes)
	return changes
}

func getResourceName(f string) string {
	lastSlash := strings.LastIndex(f, "/")
	if lastSlash == -1 {
		return f
	}
	afterSlash := f[lastSlash+1:]
	before, _, ok := strings.Cut(afterSlash, ".")
	if !ok {
		return afterSlash
	}
	return before
}

func getRelativeField(f string) string {
	lastSlash := strings.LastIndex(f, "/")
	if lastSlash == -1 {
		return f
	}
	afterSlash := f[lastSlash+1:]
	_, after, ok := strings.Cut(afterSlash, ".")
	if !ok {
		return ""
	}
	return after
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
