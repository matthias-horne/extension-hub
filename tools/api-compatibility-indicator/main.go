package main

import (
	"api-compatibility/pkg/gardener"
	"api-compatibility/pkg/helm"
	"context"
	"log/slog"
	"os"

	"github.com/urfave/cli/v3"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{}))

	cmd := &cli.Command{
		Name: "api-check",
		Commands: []*cli.Command{
			{
				Name: "extension-with-gardener",
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:     "extension-path",
						Usage:    "the path to an extension, like github.com/matthias-horne/gardener-extension-example",
						Required: true,
					},
					&cli.StringSliceFlag{
						Name:     "additional-types",
						Usage:    "additional api types to consider for the check, provided in the form package/version.TypeName",
						Required: false,
					},
				},
				Usage: "Returns a range in which an extension's Gardener API contract is valid for a given extension",
				Action: func(ctx context.Context, cmd *cli.Command) error {
					return gardener.CompatibilityRange(ctx, log, cmd)
				},
			},
			{
				Name: "extension-with-helm",
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:     "chart-oci-path",
						Usage:    "the path to a helm oci chart artifact",
						Required: true,
					},
				},
				Usage: "Returns a range in which an extension's Kubernetes API contract for the rendered helm chart is valid for a given extension",
				Action: func(ctx context.Context, cmd *cli.Command) error {
					return helm.CompatibilityRange(ctx, log, cmd)
				},
			},
		},
		Flags: []cli.Flag{
			cli.VersionFlag,
			cli.HelpFlag,
		},
	}

	if err := cmd.Run(context.Background(), os.Args); err != nil {
		log.Error("error during command execution", "error", err)
		os.Exit(1)
	}
}
