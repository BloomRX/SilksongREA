import path from 'node:path';
import { readFile, readdir, stat } from 'node:fs/promises';
import {
  containsSensitiveContent,
  ensureDir,
  formatBytes,
  formatDuration,
  relativePosix,
  removeDirectoryContents,
  sanitizeText,
  TOOL_VERSION,
  walkFiles,
  writeJsonAtomic,
  writeFileAtomic,
} from './utils.mjs';

const LOCAL_KEYS = new Set([
  'root', 'cliPath', 'packagePath', 'stdoutPath', 'stderrPath', 'localCopy',
  'outputDirectory', 'sourceFiles', 'manifestPath', 'inventoryPath', 'executable',
  'data', 'help', 'records', 'unreadable', 'candidates', 'overridden',
]);
const MAX_REPORT_FILE_BYTES = 512 * 1024;
const MAX_REPORT_TOTAL_BYTES = 2 * 1024 * 1024;

function publicValue(value, replacements, key = '') {
  if (LOCAL_KEYS.has(key)) return undefined;
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return sanitizeText(value, replacements).slice(0, 12000);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value
      .map((entry) => publicValue(entry, replacements, key))
      .filter((entry) => entry !== undefined);
  }
  if (typeof value === 'object') {
    const output = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      const projected = publicValue(childValue, replacements, childKey);
      if (projected !== undefined) output[childKey] = projected;
    }
    return output;
  }
  return String(value);
}

export function projectPublicRun(run, replacements) {
  const projected = publicValue(run, replacements);
  projected.schemaVersion = 1;
  projected.toolVersion = TOOL_VERSION;
  if (Array.isArray(projected.playerLogs)) {
    projected.playerLogs = projected.playerLogs.map((log) => {
      const { path: _privatePath, ...withoutPath } = log;
      return {
        ...withoutPath,
        groups: Array.isArray(log.groups) ? log.groups.slice(0, 50) : [],
        excerpt: Array.isArray(log.excerpt) ? log.excerpt.slice(-80) : [],
      };
    });
  }
  return projected;
}

function markdown(value) {
  return String(value ?? '—')
    .replaceAll('|', '\\|')
    .replaceAll('\r', ' ')
    .replaceAll('\n', ' ')
    .slice(0, 1500);
}

function code(value) {
  return `\`${String(value ?? '—').replaceAll('`', '\\`')}\``;
}

export function statusLabel(status) {
  return {
    success: '✅ OK',
    failed: '❌ FALHOU',
    warning: '⚠️ AVISO',
    skipped: '⏭️ IGNORADO',
    running: '⏳ EM EXECUÇÃO',
    pending: '↻ AO FINAL',
  }[status] || `❔ ${status || 'DESCONHECIDO'}`;
}

function stageRows(stages) {
  if (!stages?.length) return '| Nenhuma etapa executada | — | — | — |';
  return stages.map((stage) => `| ${markdown(stage.title || stage.id)} | ${statusLabel(stage.status)} | ${formatDuration(stage.durationMs)} | ${markdown(stage.message || stage.reason || '')} |`).join('\n');
}

function hashesRows(hashes = []) {
  if (!hashes.length) return '| Nenhum arquivo-chave encontrado | — | — |';
  return hashes.map((file) => `| ${code(file.path)} | ${file.bytes === undefined ? '—' : formatBytes(file.bytes)} | ${file.sha256 ? code(file.sha256) : markdown(file.error || '—')} |`).join('\n');
}

function renderIndex(run) {
  const game = run.game || {};
  const inventory = run.inventory || {};
  const managed = run.managed || {};
  const decompilation = run.decompilation || {};
  const failed = (run.stages || []).filter((stage) => stage.status === 'failed').length;
  const warnings = (run.stages || []).filter((stage) => stage.status === 'warning').length;
  return `# Relatório SilksongREA\n\n` +
    `**Execução:** ${code(run.runId)}  \n` +
    `**Início (UTC):** ${code(run.startedAt)}  \n` +
    `**Status geral:** ${statusLabel(run.status)}  \n` +
    `**Runtime detectado:** ${markdown(game.runtime)}  \n` +
    `**Origem da detecção:** ${markdown(game.source)}\n\n` +
    `> Este é um relatório sanitizado. Código decompilado, CIL completo, inventário CSV, logs brutos e demais artefatos locais não são publicados.\n\n` +
    `## Resumo\n\n` +
    `- Arquivos inventariados: **${inventory.fileCount ?? 0}** (${formatBytes(inventory.totalBytes || 0)}).\n` +
    `- Assemblies gerenciados encontrados: **${managed.assemblyCount ?? 0}**.\n` +
    `- Decompilação ILSpy: **${statusLabel(decompilation.status || 'skipped')}**; ${decompilation.sourceFileCount ?? 0} arquivos C# e ${decompilation.totalLines ?? 0} linhas locais.\n` +
    `- Etapas com falha: **${failed}**; etapas com aviso: **${warnings}**.\n\n` +
    `## Etapas\n\n| Etapa | Status | Duração | Observação |\n|---|---|---:|---|\n${stageRows(run.stages)}\n\n` +
    `## Integridade dos arquivos principais\n\n| Arquivo relativo | Tamanho | SHA-256 |\n|---|---:|---|\n${hashesRows(inventory.hashes)}\n\n` +
    `## Relatórios\n\n` +
    `- [Inventário resumido](files.md)\n` +
    `- [Análise gerenciada e decompilação](managed.md)\n` +
    `- [Cobertura e limitações](coverage.md)\n` +
    `- [Erros, avisos e Player.log](errors.md)\n` +
    `- [Resumo legível por máquina](summary.json)\n\n` +
    `## Onde estão os resultados completos\n\n` +
    `Somente no computador que executou a análise, em ${code('.local/')}. Esse diretório é ignorado pelo Git e pode conter material protegido do jogo. Não o envie para o repositório.\n`;
}

function renderFiles(run) {
  const inventory = run.inventory || {};
  const extensions = (inventory.byExtension || []).slice(0, 30);
  const topLevels = (inventory.byTopLevel || []).slice(0, 30);
  return `# Inventário resumido\n\n` +
    `- Arquivos: **${inventory.fileCount ?? 0}**\n` +
    `- Bytes totais: **${formatBytes(inventory.totalBytes || 0)}**\n` +
    `- Links simbólicos ignorados: **${inventory.symlinkCount ?? 0}**\n` +
    `- Entradas ilegíveis: **${inventory.unreadableCount ?? 0}**\n\n` +
    `## Extensões por espaço ocupado\n\n| Extensão | Arquivos | Bytes |\n|---|---:|---:|\n` +
    `${extensions.map((entry) => `| ${code(entry.extension)} | ${entry.count} | ${formatBytes(entry.bytes)} |`).join('\n') || '| — | — | — |'}\n\n` +
    `## Primeiro nível de diretórios\n\n| Entrada | Arquivos | Bytes |\n|---|---:|---:|\n` +
    `${topLevels.map((entry) => `| ${code(entry.name)} | ${entry.count} | ${formatBytes(entry.bytes)} |`).join('\n') || '| — | — | — |'}\n\n` +
    `## Hashes de integridade\n\n| Arquivo relativo | Tamanho | SHA-256 |\n|---|---:|---|\n${hashesRows(inventory.hashes)}\n\n` +
    `O CSV com todos os caminhos e tamanhos fica apenas no diretório local da execução.\n`;
}

function commandRows(commands = []) {
  if (!commands.length) return '| Nenhum comando executado | — | — | — |';
  return commands.map((result) => {
    const label = [result.command, result.target].filter(Boolean).join(' — ');
    const counts = Object.entries(result.collections || {})
      .filter(([key]) => ['types', 'fields', 'methods', 'member_refs', 'call_edges', 'user_strings', 'resources', 'pinvoke_imports'].includes(key))
      .map(([key, count]) => `${key}=${count}`)
      .join(', ');
    const unmatched = result.unmatchedTypes?.length ? `tipos não encontrados: ${result.unmatchedTypes.join(', ')}` : '';
    const observation = [result.message || result.reason || result.parseError, counts, unmatched].filter(Boolean).join('; ');
    return `| ${markdown(label)} | ${statusLabel(result.status)} | ${formatBytes(result.outputBytes || 0)} | ${markdown(observation)} |`;
  }).join('\n');
}

function renderManaged(run) {
  const managed = run.managed || {};
  const decompilation = run.decompilation || {};
  const focus = decompilation.focusTypes || [];
  return `# Análise gerenciada e decompilação\n\n` +
    `- Runtime: **${markdown(run.game?.runtime)}**\n` +
    `- Assemblies na pasta Managed: **${managed.assemblyCount ?? 0}**\n` +
    `- REA: **${code(run.environment?.reaVersion || 'indisponível')}**\n` +
    `- ILSpyCmd: **${code(run.environment?.ilspyVersion || 'indisponível')}**\n\n` +
    `## Comandos REA\n\n| Alvo/comando | Status | Saída local | Observação |\n|---|---|---:|---|\n${commandRows(managed.commands)}\n\n` +
    `Cobertura partial ou unavailable representa limite/indisponibilidade da inspeção, não ausência dos membros no jogo. O JSON bruto e o CIL recuperado ficam somente no computador local.\n\n` +
    `## Decompilação local com ILSpy\n\n` +
    `- Status: **${statusLabel(decompilation.status || 'skipped')}**\n` +
    `- Arquivos produzidos: **${decompilation.fileCount ?? 0}**\n` +
    `- Arquivos C#: **${decompilation.sourceFileCount ?? 0}**\n` +
    `- Linhas C# locais: **${decompilation.totalLines ?? 0}**\n` +
    `- Bytes locais: **${formatBytes(decompilation.totalBytes || 0)}**\n\n` +
    `${decompilation.message ? `**Diagnóstico:** ${markdown(decompilation.message)}\n\n` : ''}` +
    `### Tipos prioritários\n\n| Tipo | Encontrado na decompilação | Arquivo local relativo |\n|---|---|---|\n` +
    `${focus.map((entry) => `| ${code(entry.name)} | ${entry.found ? 'sim' : 'não'} | ${entry.source ? code(entry.source) : '—'} |`).join('\n') || '| Nenhum | — | — |'}\n\n` +
    `Os corpos dos métodos, literais, CIL e o código C# não são publicados neste relatório.\n`;
}

function renderCoverage(run) {
  const byId = Object.fromEntries((run.stages || []).map((stage) => [stage.id, stage]));
  const rows = [
    ['Inventário de arquivos e tamanhos', 'inventory', 'Metadados do layout; o conteúdo dos assets não é extraído.'],
    ['SHA-256 dos arquivos principais', 'inventory', 'Usado para identificar exatamente a build analisada.'],
    ['Identidade de todos os assemblies .NET', 'managed-artifacts', 'Somente arquivos admitidos pelo parser do REA.'],
    ['Membros/CIL do Assembly-CSharp', 'managed-members', 'Saída bruta local; cobertura partial/unavailable é avisada e complementada pela inspeção focada e pelo ILSpy.'],
    ['Fronteiras nativas gerenciadas', 'managed-native', 'P/Invoke e indicadores de implementação nativa, quando suportados.'],
    ['Decompilação C# com ILSpy', 'decompile', 'Saída completa somente local.'],
    ['Recursos PE', 'native-pe', 'Apenas comandos existentes no REA publicado; não equivale a descompilação nativa.'],
    ['Metadados IL2CPP', 'il2cpp', 'Executado apenas quando um alvo IL2CPP é encontrado.'],
    ['Player.log', 'player-logs', 'Somente caminhos convencionais; trechos limitados e sanitizados.'],
    ['Publicação Git', 'publish', 'Somente reports/latest; nunca git add -A.'],
  ];
  return `# Cobertura e limitações\n\n| Área | Status nesta execução | Limite conhecido |\n|---|---|---|\n` +
    `${rows.map(([label, id, limitation]) => {
      const status = id === 'publish' ? (run.publication?.status || 'pending') : (byId[id]?.status || 'skipped');
      return `| ${label} | ${statusLabel(status)} | ${markdown(limitation)} |`;
    }).join('\n')}\n\n` +
    `## Fora do modo automático\n\n` +
    `- **PlayMaker/FSM ao vivo:** requer instrumentação ou inspeção em execução; o pipeline não injeta mods nem inicia o jogo.\n` +
    `- **Cenas, prefabs e assets renderizáveis:** há inventário, mas não exportação com AssetRipper.\n` +
    `- **Descompilação nativa profunda:** requer Ghidra, IDA ou Hopper e uma investigação separada.\n` +
    `- **Comportamento dinâmico:** valores reais de física, timers e transições precisam de confirmação em runtime.\n` +
    `- **Reconstrução Godot:** nenhuma mecânica é considerada reproduzida apenas porque o código foi lido.\n\n` +
    `Uma etapa ignorada ou indisponível nunca deve ser interpretada como prova de que o recurso não existe no jogo.\n`;
}

function renderErrors(run, replacements) {
  const problematic = (run.stages || []).filter((stage) => ['failed', 'warning'].includes(stage.status));
  const logs = run.playerLogs || [];
  let output = `# Erros, avisos e Player.log\n\n## Etapas\n\n`;
  if (!problematic.length) {
    output += 'Nenhuma etapa terminou com erro ou aviso.\n';
  } else {
    for (const stage of problematic) {
      output += `\n### ${markdown(stage.title || stage.id)} — ${statusLabel(stage.status)}\n\n`;
      output += `${code(sanitizeText(stage.message || stage.reason || 'Sem diagnóstico.', replacements))}\n`;
    }
  }
  output += `\n## Player.log\n\n`;
  if (!logs.length) {
    output += 'Nenhum Player.log convencional foi encontrado ou a coleta estava desativada.\n';
  }
  for (const [index, log] of logs.entries()) {
    output += `\n### Log ${index + 1}\n\n`;
    if (log.error) {
      output += `${code(sanitizeText(log.error, replacements))}\n`;
      continue;
    }
    output += `- Tamanho: ${formatBytes(log.bytes || 0)}\n` +
      `- Leitura truncada: ${log.truncated ? 'sim; somente o trecho final foi examinado' : 'não'}\n` +
      `- Linhas examinadas: ${log.lineCount ?? 0}\n` +
      `- Linhas com termos de erro/aviso: ${log.matchCount ?? 0}\n\n`;
    const groups = (log.groups || []).slice(0, 20);
    output += `| Ocorrências | Mensagem normalizada |\n|---:|---|\n` +
      `${groups.map((group) => `| ${group.count} | ${markdown(sanitizeText(group.message, replacements))} |`).join('\n') || '| 0 | Nenhuma ocorrência reconhecida |'}\n`;
    const excerpt = (log.excerpt || []).slice(-80);
    if (excerpt.length) {
      output += `\n<details><summary>Últimas linhas relevantes (máximo 80)</summary>\n\n\`\`\`text\n` +
        `${sanitizeText(excerpt.join('\n'), replacements).slice(0, 30000)}\n\`\`\`\n\n</details>\n`;
    }
  }
  if (run.previousPublication?.message) {
    output += `\n## Publicação anterior\n\n${code(sanitizeText(run.previousPublication.message, replacements))}\n`;
  }
  return output;
}

export async function writeReports({ reportDirectory, run, replacements }) {
  await ensureDir(reportDirectory);
  await removeDirectoryContents(reportDirectory);
  const publicRun = projectPublicRun(run, replacements);
  const documents = new Map([
    ['README.md', renderIndex(publicRun)],
    ['files.md', renderFiles(publicRun)],
    ['managed.md', renderManaged(publicRun)],
    ['coverage.md', renderCoverage(publicRun)],
    ['errors.md', renderErrors(publicRun, replacements)],
  ]);
  for (const [name, contents] of documents) {
    await writeFileAtomic(path.join(reportDirectory, name), contents);
  }
  await writeJsonAtomic(path.join(reportDirectory, 'summary.json'), publicRun);
  return publicRun;
}

export async function validateReportDirectory(reportDirectory) {
  const problems = [];
  let totalBytes = 0;
  let fileCount = 0;
  for await (const entry of walkFiles(reportDirectory)) {
    if (entry.error || entry.symlink) {
      problems.push(`Entrada inválida: ${entry.relativePath}`);
      continue;
    }
    fileCount += 1;
    totalBytes += entry.size;
    if (entry.size > MAX_REPORT_FILE_BYTES) {
      problems.push(`${entry.relativePath} excede ${MAX_REPORT_FILE_BYTES} bytes.`);
    }
    if (!/\.(?:md|json)$/i.test(entry.path)) {
      problems.push(`${entry.relativePath} tem extensão não permitida.`);
      continue;
    }
    const contents = await readFile(entry.path, 'utf8');
    if (containsSensitiveContent(contents)) {
      problems.push(`${entry.relativePath} contém caminho privado ou segredo.`);
    }
  }
  if (totalBytes > MAX_REPORT_TOTAL_BYTES) {
    problems.push(`Os relatórios excedem ${MAX_REPORT_TOTAL_BYTES} bytes no total.`);
  }
  return { ok: problems.length === 0, problems, totalBytes, fileCount };
}
