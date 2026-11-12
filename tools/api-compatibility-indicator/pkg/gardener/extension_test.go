package gardener

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestReadControllerRegistrationResources(t *testing.T) {
	for _, test := range []struct {
		name      string
		yaml      string
		want      []string
		wantError bool
	}{
		{
			name: "multiple documents",
			yaml: "kind: Namespace\n---\nkind: ControllerRegistration\nspec:\n  resources:\n  - kind: Extension\n  - kind: Worker\n",
			want: []string{"Extension", "Worker"},
		},
		{name: "malformed YAML", yaml: "kind: [\n", wantError: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			dir := t.TempDir()
			if err := os.Mkdir(filepath.Join(dir, "example"), 0755); err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(filepath.Join(dir, "example", "controller-registration.yaml"), []byte(test.yaml), 0644); err != nil {
				t.Fatal(err)
			}
			got, err := readControllerRegistrationResources(dir)
			if (err != nil) != test.wantError || !reflect.DeepEqual(got, test.want) {
				t.Fatalf("resources = %v, error = %v, want %v, wantError = %v", got, err, test.want, test.wantError)
			}
		})
	}
}
