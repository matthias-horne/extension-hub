package gardener

import (
	"errors"
	"fmt"
	"io"
	"os"
	"path"

	"k8s.io/apimachinery/pkg/util/yaml"
)

// readResources returns the API resource kinds an extension reconciles. Newer
// extensions declare them in the operator Extension resource example, while
// older extensions only ship a ControllerRegistration.
func readResources(extBaseDir string) ([]string, error) {
	for _, name := range []string{"extension.yaml", "extension.yml"} {
		file := path.Join(extBaseDir, "example", name)

		resources, err := readResourcesFromFile(file, "Extension")
		if errors.Is(err, os.ErrNotExist) {
			continue
		}
		if err != nil {
			return nil, fmt.Errorf("error reading %s: %w", name, err)
		}
		if len(resources) > 0 {
			return resources, nil
		}
	}

	resources, err := readResourcesFromFile(path.Join(extBaseDir, "example", "controller-registration.yaml"), "ControllerRegistration")
	if err != nil {
		return nil, fmt.Errorf("error reading controller-registration.yaml: %w", err)
	}

	return resources, nil
}

func readResourcesFromFile(file, kind string) ([]string, error) {
	var resources []string

	f, err := os.OpenFile(file, os.O_RDONLY, os.ModePerm)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	decoder := yaml.NewYAMLOrJSONDecoder(f, 4096)

	for {
		type resource struct {
			Kind string `json:"kind"`
			Spec struct {
				Resources []struct {
					Kind string `json:"kind"`
				} `json:"resources"`
			} `json:"spec"`
		}

		var res resource

		err := decoder.Decode(&res)
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("error decoding %s: %w", path.Base(file), err)
		}

		if res.Kind == kind {
			for _, resourceKind := range res.Spec.Resources {
				resources = append(resources, resourceKind.Kind)
			}
		}
	}

	return resources, nil
}
