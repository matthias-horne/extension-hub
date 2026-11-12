package gardener

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestReadResources(t *testing.T) {
	const (
		controllerRegistration = "kind: ControllerRegistration\nspec:\n  resources:\n  - kind: BackupBucket\n"
		extension              = "kind: Extension\nspec:\n  resources:\n  - kind: Extension\n  - kind: Worker\n"
	)

	for _, test := range []struct {
		name      string
		files     map[string]string
		want      []string
		wantError bool
	}{
		{
			name:  "prefers extension.yaml over controller-registration.yaml",
			files: map[string]string{"extension.yaml": extension, "controller-registration.yaml": controllerRegistration},
			want:  []string{"Extension", "Worker"},
		},
		{
			name:  "supports extension.yml",
			files: map[string]string{"extension.yml": extension},
			want:  []string{"Extension", "Worker"},
		},
		{
			name:  "falls back to controller-registration.yaml",
			files: map[string]string{"controller-registration.yaml": controllerRegistration},
			want:  []string{"BackupBucket"},
		},
		{
			name: "falls back when extension.yaml has no resources",
			files: map[string]string{
				"extension.yaml":               "kind: Extension\nspec:\n  type: example\n",
				"controller-registration.yaml": controllerRegistration,
			},
			want: []string{"BackupBucket"},
		},
		{
			name:  "multiple documents",
			files: map[string]string{"extension.yaml": "kind: Namespace\n---\n" + extension},
			want:  []string{"Extension", "Worker"},
		},
		{
			name:      "malformed extension YAML",
			files:     map[string]string{"extension.yaml": "kind: [\n"},
			wantError: true,
		},
		{
			name:      "no example resources",
			files:     map[string]string{},
			wantError: true,
		},
	} {
		t.Run(test.name, func(t *testing.T) {
			dir := t.TempDir()
			if err := os.Mkdir(filepath.Join(dir, "example"), 0755); err != nil {
				t.Fatal(err)
			}
			for name, contents := range test.files {
				if err := os.WriteFile(filepath.Join(dir, "example", name), []byte(contents), 0644); err != nil {
					t.Fatal(err)
				}
			}

			got, err := readResources(dir)
			if (err != nil) != test.wantError || !reflect.DeepEqual(got, test.want) {
				t.Fatalf("resources = %v, error = %v, want %v, wantError = %v", got, err, test.want, test.wantError)
			}
		})
	}
}
