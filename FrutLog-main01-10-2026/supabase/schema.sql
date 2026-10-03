create extension if not exists pgcrypto;

create table if not exists talhoes (id text primary key, cultura text not null, area text not null);
create table if not exists usuarios (id uuid primary key default gen_random_uuid(), matricula text unique not null, nome text not null, perfil text not null check (perfil in ('engenheiro','tecnico','admin')), cargo text not null default '', senha_hash text not null, ativo boolean not null default true, created_at timestamptz not null default now());
alter table usuarios add column if not exists cargo text not null default '';
create table if not exists dispositivos_iot (id text primary key, talhao text not null references talhoes(id), ativo boolean not null default true, created_at timestamptz not null default now());
create table if not exists sensores (id text primary key, talhao text not null references talhoes(id), tipo text not null, unidade text not null, valor numeric not null, atualizado_em timestamptz not null);
create table if not exists telemetrias (id bigint generated always as identity primary key, sensor_id text not null references dispositivos_iot(id), talhao text not null references talhoes(id), tipo text not null, valor numeric not null, unidade text, registrado_em timestamptz not null default now());
create index if not exists telemetrias_sensor_data on telemetrias(sensor_id, registrado_em desc);
create table if not exists inspecoes (id bigint generated always as identity primary key, data date not null, talhao text not null references talhoes(id), situacao text not null, problemas text, observacoes text, usuario_id uuid references usuarios(id), created_at timestamptz not null default now());
create table if not exists ocorrencias (id bigint generated always as identity primary key, talhao text not null references talhoes(id), tipo text not null, observacao text, usuario_id uuid references usuarios(id), created_at timestamptz not null default now());
create table if not exists problemas_sensor (id bigint generated always as identity primary key, sensor text not null references dispositivos_iot(id), talhao text not null references talhoes(id), data date not null, problema text not null, observacao text, usuario_id uuid references usuarios(id), created_at timestamptz not null default now());
create table if not exists plantios (id bigint generated always as identity primary key, produto text not null, variedade text not null, talhao text not null references talhoes(id), area numeric not null check (area > 0), solo text not null, data_plantio date not null, data_colheita date not null, usuario_id uuid references usuarios(id), created_at timestamptz not null default now());

alter table talhoes enable row level security;
alter table usuarios enable row level security;
alter table dispositivos_iot enable row level security;
alter table sensores enable row level security;
alter table telemetrias enable row level security;
alter table inspecoes enable row level security;
alter table ocorrencias enable row level security;
alter table problemas_sensor enable row level security;
alter table plantios enable row level security;

insert into talhoes (id,cultura,area) values ('A1','Uva Isabel','10 hectares'),('A2','Manga Tommy Atkins','8 hectares'),('B1','Uva Sugar Crisp','9 hectares'),('B2','Melao Goldex','7,6 hectares') on conflict do nothing;
insert into dispositivos_iot (id,talhao) values ('TEMP-A1-01','A1'),('SOLO-A2-01','A2'),('CHUVA-B1-01','B1'),('SOLO-B2-01','B2') on conflict do nothing;
-- Administrador inicial: altere a senha logo apos o primeiro acesso.
insert into usuarios (matricula,nome,perfil,cargo,senha_hash,ativo)
values ('admin','Administrador FrutLog','admin','Administrador do sistema','pbkdf2$210000$6e46e64ca76deb2e512732032c4bcaa3$04afb71448722883dc9181b98853d43394f706e4b898dabeeab9d5c6a1f8a4b7',true)
on conflict (matricula) do nothing;
