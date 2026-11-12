package gomodules

import (
	"archive/zip"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestDownloadOutsideModuleReusesCache(t *testing.T) {
	const module = "example.com/test-extension"
	const version = "v1.0.0"
	dir := t.TempDir()
	proxy := filepath.Join(dir, "proxy")
	versions := filepath.Join(proxy, module, "@v")
	if err := os.MkdirAll(versions, 0755); err != nil {
		t.Fatal(err)
	}
	goMod := "module " + module + "\n\ngo 1.20\n"
	for name, data := range map[string]string{
		version + ".mod":  goMod,
		version + ".info": `{"Version":"v1.0.0","Time":"2026-11-01T00:00:00Z"}`,
	} {
		if err := os.WriteFile(filepath.Join(versions, name), []byte(data), 0644); err != nil {
			t.Fatal(err)
		}
	}
	archive, err := os.Create(filepath.Join(versions, version+".zip"))
	if err != nil {
		t.Fatal(err)
	}
	writer := zip.NewWriter(archive)
	entry, err := writer.Create(module + "@" + version + "/go.mod")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := entry.Write([]byte(goMod)); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	if err := archive.Close(); err != nil {
		t.Fatal(err)
	}
	t.Setenv("GOPROXY", "file://"+proxy)
	t.Setenv("GOSUMDB", "off")
	t.Setenv("GOMODCACHE", filepath.Join(dir, "cache"))
	t.Setenv("GOWORK", "off")
	t.Setenv("GOFLAGS", "-modcacherw")
	t.Setenv("GONOPROXY", "none")
	t.Chdir(dir)

	first, err := DownloadAndGetModuleDir(module + "@" + version)
	if err != nil {
		t.Fatal(err)
	}
	if data, err := os.ReadFile(filepath.Join(first, "go.mod")); err != nil || string(data) != goMod {
		t.Fatalf("downloaded module go.mod = %q, error = %v", data, err)
	}
	// With the proxy removed, a second extension check must use the cached module.
	if err := os.RemoveAll(proxy); err != nil {
		t.Fatal(err)
	}
	second, err := DownloadAndGetModuleDir(module + "@" + version)
	if err != nil || first != second {
		t.Fatalf("cached directory = %q, want %q, error = %v", second, first, err)
	}
	if _, err := DownloadAndGetModuleDir(module + "@v1.0.1"); err == nil || !strings.Contains(err.Error(), "no such file") {
		t.Fatalf("missing module should report the download error, got %v", err)
	}
}
