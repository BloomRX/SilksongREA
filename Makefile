# Atalhos do kit de clean room. Use `make` para ver a lista.

SHELL := /bin/bash
TARGET ?=
VERSION ?= 0.1.0

.DEFAULT_GOAL := help
.PHONY: help bootstrap target hash check handoff verify test lint demo clean-demo rooms

help: ## Mostra esta ajuda
	@echo "Kit de clean room com REA"
	@echo
	@awk 'BEGIN {FS = ":.*## "} /^[a-zA-Z_-]+:.*## / {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo
	@echo "Variáveis: TARGET=<slug> VERSION=<x.y.z>"
	@echo "Exemplo:   make check TARGET=meu-jogo"

bootstrap: ## Instala REA, registra MCP e cria os guards
	./scripts/bootstrap.sh

target: ## Cria um alvo: make target TARGET=meu-jogo NAME="Meu Jogo"
	@test -n "$(TARGET)" || { echo "defina TARGET=<slug>"; exit 1; }
	./scripts/new-target.sh "$(TARGET)" $(if $(NAME),--name "$(NAME)",)

hash: ## Registra hashes dos artefatos: make hash TARGET=meu-jogo
	@test -n "$(TARGET)" || { echo "defina TARGET=<slug>"; exit 1; }
	./scripts/hash-artifacts.sh "$(TARGET)"

check: ## Portão da spec: make check TARGET=meu-jogo
	@test -n "$(TARGET)" || { echo "defina TARGET=<slug>"; exit 1; }
	node scripts/check-spec.mjs "targets/$(TARGET)/analysis/spec/spec.md" --strict
	@npm test --silent

handoff: ## Sela o handoff: make handoff TARGET=meu-jogo VERSION=0.1.0
	@test -n "$(TARGET)" || { echo "defina TARGET=<slug>"; exit 1; }
	./scripts/handoff.sh "$(TARGET)" "$(VERSION)"

verify: ## Audita isolamento: make verify TARGET=meu-jogo
	./scripts/verify-isolation.sh $(TARGET)

test: ## Testa as ferramentas do kit
	npm test

lint: ## Checagem de sintaxe dos scripts
	npm run lint:scripts
	bash -n scripts/bootstrap.sh scripts/new-target.sh scripts/handoff.sh \
	        scripts/verify-isolation.sh scripts/hash-artifacts.sh scripts/lib/common.sh

demo: ## Gera um alvo de demonstração e o handoff de exemplo
	@rm -rf targets/demo-target
	./scripts/new-target.sh demo-target --name "Demo" --version "0.9.0"
	cp examples/pan-mechanic/spec.md targets/demo-target/analysis/spec/spec.md
	cp examples/pan-mechanic/golden.json targets/demo-target/analysis/golden/golden.json
	./scripts/handoff.sh demo-target 0.1.0
	@echo "Rode: make verify TARGET=demo-target"

clean-demo: ## Remove o alvo de demonstração
	@if [ -d targets/demo-target ]; then chmod -R u+w targets/demo-target && rm -rf targets/demo-target; fi

rooms: ## Lembra as duas salas e o que fazer em cada uma
	@echo "análise:   cd rooms/analysis && claude   (ou codex)"
	@echo "limpa:     cd rooms/impl     && claude   (ou codex)"
