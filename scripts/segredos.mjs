#!/usr/bin/env node
// Varredura de segredos com gitleaks (ADR 0005). Roda no CI (job validate) e localmente.
// Uso: node scripts/segredos.mjs [--base <ref>] [--head <ref>]
//   Com --base: varre só os commits base..head (PR). Sem --base: varre todo o histórico.
// Baixa o binário do release oficial, confere o SHA-256 e guarda em .cache/gitleaks/ (ignorado pelo git).
// Falso positivo: adicionar a linha indicada pelo gitleaks em .gitleaksignore, com o motivo, em PR de starter.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const VERSION = '8.30.1';
// Do arquivo gitleaks_8.30.1_checksums.txt do release oficial. Trocar versão = trocar estes valores.
const ASSETS = {
  'linux-x64': ['linux_x64.tar.gz', '551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb'],
  'linux-arm64': ['linux_arm64.tar.gz', 'e4a487ee7ccd7d3a7f7ec08657610aa3606637dab924210b3aee62570fb4b080'],
  'darwin-x64': ['darwin_x64.tar.gz', 'dfe101a4db2255fc85120ac7f3d25e4342c3c20cf749f2c20a18081af1952709'],
  'darwin-arm64': ['darwin_arm64.tar.gz', 'b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5'],
  'win32-x64': ['windows_x64.zip', 'd29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e'],
};

function arg(name) {
  const index = process.argv.indexOf(name);
  return index > -1 ? process.argv[index + 1] : undefined;
}

const platform = `${process.platform}-${process.arch}`;
const asset = ASSETS[platform];
if (!asset) {
  console.error(`segredos: plataforma ${platform} sem binário configurado do gitleaks.`);
  process.exit(2);
}

const dir = join(ROOT, '.cache', 'gitleaks', VERSION);
const binary = join(dir, process.platform === 'win32' ? 'gitleaks.exe' : 'gitleaks');

if (!existsSync(binary)) {
  mkdirSync(dir, { recursive: true });
  const name = `gitleaks_${VERSION}_${asset[0]}`;
  const url = `https://github.com/gitleaks/gitleaks/releases/download/v${VERSION}/${name}`;
  const response = await fetch(url);
  if (!response.ok) {
    console.error(`segredos: download falhou (${response.status}) ${url}`);
    process.exit(2);
  }
  const data = Buffer.from(await response.arrayBuffer());
  const sha = createHash('sha256').update(data).digest('hex');
  if (sha !== asset[1]) {
    console.error(`segredos: SHA-256 não confere para ${name} (esperado ${asset[1]}, obtido ${sha}). Abortado.`);
    process.exit(2);
  }
  const archive = join(dir, name);
  writeFileSync(archive, data);
  // tar extrai .tar.gz; no Windows usa o tar.exe do sistema (bsdtar, abre .zip). O tar do Git Bash
  // (GNU) leria "C:" como host remoto.
  const tar = process.platform === 'win32' ? join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe') : 'tar';
  const extract = spawnSync(tar, ['-xf', archive, '-C', dir], { encoding: 'utf8' });
  if (extract.status !== 0 || !existsSync(binary)) {
    console.error(`segredos: falha ao extrair ${name}: ${extract.stderr}`);
    process.exit(2);
  }
}

const base = arg('--base');
const head = arg('--head') ?? 'HEAD';
const args = ['git', ROOT, '--redact', '--no-banner', '--exit-code', '1'];
if (base) args.push('--log-opts', `${base}..${head}`);
const ignore = join(ROOT, '.gitleaksignore');
if (existsSync(ignore) && readFileSync(ignore, 'utf8').trim() !== '') args.push('--gitleaks-ignore-path', ignore);

const result = spawnSync(binary, args, { cwd: ROOT, stdio: 'inherit' });
if (result.status === 0) {
  console.log(`segredos: nenhum segredo encontrado (${base ? `${base}..${head}` : 'histórico completo'})`);
} else {
  console.error('segredos: possível segredo encontrado. Revogue/troque o segredo; não basta apagar no commit seguinte (docs/regras/repositorio-publico.md).');
}
process.exit(result.status ?? 1);
