package gardener

import (
	"errors"
	"fmt"
	"io"
	"os"
	"path"

	"k8s.io/apimachinery/pkg/util/yaml"
)

func readControllerRegistrationResources(extBaseDir string) ([]string, error) {
	var resources []string

	f, err := os.OpenFile(path.Join(extBaseDir, "example", "controller-registration.yaml"), os.O_RDONLY, os.ModePerm)
	if err != nil {
		return nil, fmt.Errorf("error to open controller-registration.yaml: %w", err)
	}
	defer f.Close()

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
		if err != nil {
			return nil, fmt.Errorf("error decoding controller-registration.yaml: %w", err)
		}

		if res.Kind == "ControllerRegistration" {
			for _, resourceKind := range res.Spec.Resources {
				resources = append(resources, resourceKind.Kind)
			}
		}
	}

	return resources, nil
}
