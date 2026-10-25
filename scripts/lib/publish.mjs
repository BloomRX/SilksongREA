import path from 'node:path';
import {
  relativePosix,
  runProcess,
  tail,
} from './utils.mjs';
import { validateReportDirectory } from './reports.mjs';

function gitEnvironment() {
  return {
    GIT_TERMINAL_PROMPT: '0',
    GIT_EDITOR: 'true',
    GIT_SEQUENCE_EDITOR: 'true',
  };
}

async function git({ executable, repositoryRoot, args, timeoutMs = 120000 }) {
  const result = await runProcess({
    command: executable,
    args: ['-C', repositoryRoot, ...args],
    env: gitEnvironment(),
    timeoutMs,
  });
  return result;
}

async function requireRepository(executable, repositoryRoot) {
  const topLevel = await git({ executable, repositoryRoot, args: ['rev-parse', '--show-toplevel'] });
  if (!topLevel.ok) throw new Error(`O diretório não é um repositório Git utilizável: ${tail(topLevel.stderr)}`);
  const branchResult = await git({ executable, repositoryRoot, args: ['rev-parse', '--abbrev-ref', 'HEAD'] });
  const branch = branchResult.stdout.trim();
  if (!branchResult.ok || !branch || branch === 'HEAD') {
    throw new Error('A publicação automática não funciona em HEAD destacado. Use uma branch.');
  }
  const refCheck = await git({ executable, repositoryRoot, args: ['check-ref-format', '--branch', branch] });
  if (!refCheck.ok) throw new Error('O nome da branch atual não é válido para publicação.');
  for (const ref of ['REBASE_HEAD', 'MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD']) {
    const operation = await git({ executable, repositoryRoot, args: ['rev-parse', '--verify', '--quiet', ref] });
    if (operation.ok) {
      throw new Error(`Há uma operação Git em andamento (${ref}). Conclua ou cancele essa operação antes de publicar relatórios.`);
    }
  }
  return { branch };
}

export async function prepareRepository({ executable, repositoryRoot, enabled }) {
  if (!enabled) return { status: 'skipped', reason: 'Publicação desativada pela opção --no-publish.' };
  if (!executable) return { status: 'failed', message: 'Git não encontrado no PATH nem nas instalações convencionais.' };
  try {
    const { branch } = await requireRepository(executable, repositoryRoot);
    const status = await git({ executable, repositoryRoot, args: ['status', '--porcelain'] });
    if (!status.ok) return { status: 'failed', message: tail(status.stderr) };
    if (status.stdout.trim()) {
      return {
        status: 'warning',
        branch,
        message: 'Pull inicial ignorado porque já havia alterações locais. Nenhuma delas será incluída no commit de relatórios.',
      };
    }
    const pull = await git({
      executable,
      repositoryRoot,
      args: ['pull', '--rebase', '--autostash', 'origin', branch],
      timeoutMs: 180000,
    });
    if (!pull.ok) {
      const missingRemoteBranch = /couldn't find remote ref|não foi possível encontrar a ref remota/i.test(pull.stderr);
      return {
        status: missingRemoteBranch ? 'warning' : 'failed',
        branch,
        message: missingRemoteBranch
          ? 'A branch ainda não existe no remoto; o primeiro push poderá criá-la.'
          : `Falha no pull inicial: ${tail(pull.stderr || pull.stdout)}`,
      };
    }
    return { status: 'success', branch, message: 'Branch atual sincronizada antes da análise.' };
  } catch (error) {
    return { status: 'failed', message: error.message };
  }
}

export async function publishReports({ executable, repositoryRoot, reportDirectory, runId, enabled }) {
  if (!enabled) return { status: 'skipped', reason: 'Sem pull, commit ou push (--no-publish).' };
  if (!executable) return { status: 'failed', message: 'Git não encontrado; relatório mantido apenas localmente.' };
  try {
    const { branch } = await requireRepository(executable, repositoryRoot);
    const relativeReport = relativePosix(repositoryRoot, reportDirectory);
    if (!relativeReport || relativeReport.startsWith('../') || path.isAbsolute(relativeReport)) {
      throw new Error('O diretório de relatórios precisa estar dentro do repositório.');
    }

    const validation = await validateReportDirectory(reportDirectory);
    if (!validation.ok) {
      return { status: 'failed', branch, message: `Relatório bloqueado por segurança: ${validation.problems.join(' ')}` };
    }

    const stagedBefore = await git({ executable, repositoryRoot, args: ['diff', '--cached', '--name-only'] });
    if (!stagedBefore.ok) return { status: 'failed', branch, message: tail(stagedBefore.stderr) };
    const unrelatedStaged = stagedBefore.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
      .filter((file) => !file.split('\\').join('/').startsWith(`${relativeReport}/`));
    if (unrelatedStaged.length) {
      return {
        status: 'failed',
        branch,
        message: `Há ${unrelatedStaged.length} arquivo(s) staged fora de ${relativeReport}; nada foi commitado.`,
      };
    }

    const add = await git({ executable, repositoryRoot, args: ['add', '--', relativeReport] });
    if (!add.ok) return { status: 'failed', branch, message: `git add falhou: ${tail(add.stderr)}` };

    const stagedNames = await git({ executable, repositoryRoot, args: ['diff', '--cached', '--name-only'] });
    if (!stagedNames.ok) return { status: 'failed', branch, message: tail(stagedNames.stderr) };
    const staged = stagedNames.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!staged.length) {
      return { status: 'skipped', branch, reason: 'Os relatórios não mudaram desde o último commit.' };
    }
    const escaped = staged.filter((file) => !file.split('\\').join('/').startsWith(`${relativeReport}/`));
    if (escaped.length) {
      return { status: 'failed', branch, message: 'O conjunto staged mudou durante a execução; commit cancelado por segurança.' };
    }

    const message = `chore: relatório SilksongREA ${runId}`;
    const commit = await git({
      executable,
      repositoryRoot,
      args: ['commit', '-m', message, '--', relativeReport],
    });
    if (!commit.ok) {
      return { status: 'failed', branch, message: `git commit falhou: ${tail(commit.stderr || commit.stdout)}` };
    }
    const hashResult = await git({ executable, repositoryRoot, args: ['rev-parse', 'HEAD'] });
    const commitHash = hashResult.ok ? hashResult.stdout.trim() : undefined;

    const push = await git({
      executable,
      repositoryRoot,
      args: ['push', 'origin', `HEAD:refs/heads/${branch}`],
      timeoutMs: 180000,
    });
    if (!push.ok) {
      return {
        status: 'failed',
        branch,
        commitHash,
        committed: true,
        pushed: false,
        message: `O commit foi criado, mas o push falhou: ${tail(push.stderr || push.stdout)}`,
      };
    }
    return {
      status: 'success',
      branch,
      commitHash,
      committed: true,
      pushed: true,
      message: `Relatório publicado na branch atual (${commitHash?.slice(0, 12) || 'commit'}).`,
    };
  } catch (error) {
    return { status: 'failed', message: error.message };
  }
}
