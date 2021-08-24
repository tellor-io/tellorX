help: ## Displays help.
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n\nTargets:\n"} /^[a-z0-9A-Z_-]+:.*?##/ { printf "  \033[36m%-17s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)


.PHONY: slither
slither: ## Run slither security checks.
	slither . --filter-paths "node_modules/*" --exclude-low --exclude naming-convention,solc-version,pragma,external-function,weak-prng,controlled-delegatecall,uninitialized-state-variables,incorrect-equality,unchecked-low-level-calls

.PHONY: solhint
solhint: ## Run solhint linter.
	solhint 'contracts/*.sol'






