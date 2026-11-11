package util

import (
	"context"
	"os/exec"
)

func ExecuteCmd(ctx context.Context, dir string, name string, args ...string) error {
	_, err := ExecuteCmdWithOutput(ctx, dir, name, args...)
	return err
}

func ExecuteCmdWithOutput(ctx context.Context, dir string, name string, args ...string) ([]byte, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Dir = dir
	return cmd.CombinedOutput()
}
