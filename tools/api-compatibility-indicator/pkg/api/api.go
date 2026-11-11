package api

type CompatibilityRange struct {
	Version string `json:"version"`
	From    string `json:"from"`
	To      string `json:"to"`

	BreakingOnLower  []string `json:"breaking_on_lower"`
	BreakingOnHigher []string `json:"breaking_on_higher"`
}
