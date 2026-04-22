export type Analise = {
  momento_de_vida: string;
  conversa_interna: string;
  vergonha_oculta: string;
  desejo_real: string;
  objecao_principal: string;
};

export type Script = {
  angulo: string;
  nivel_consciencia: string;
  duracao: string;
  hook: string;
  agitacao: string;
  virada: string;
  prova: string;
  cta: string;
  estrategia: string;
};

export type GuiaProducao = {
  perfil_avatar: string;
  voz: string;
  visual: string;
  edicao: string;
  checklist: string[];
};

export type BriefingInput = {
  produto: string;
  url: string;
  publico: string;
  dor: string;
  transformacao: string;
  prova: string;
  tom: string;
  duracao: string;
  plataforma: string;
  concorrente: string;
  numScripts: string;
};

export type GenerateResult = {
  analise: Analise;
  scripts: Script[];
  guiaProducao: GuiaProducao;
};