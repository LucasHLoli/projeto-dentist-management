export interface Procedure {
  id: string;
  nome: string;
  valor2025: number;
  valor2026: number;
  grupo?: string;
  isRestauracao?: boolean;
  isLimpeza?: boolean;
}

export interface RestauracaoEntry {
  faces: '1F' | '2F' | '3F' | '4F';
  quantidade: number;
  valor2025: number;
  valor2026: number;
}

const REAJUSTE = 1.0432;

function v26(v25: number): number {
  return Math.round(v25 * REAJUSTE * 100) / 100;
}

export const restauracaoTable: RestauracaoEntry[] = [
  { faces: '1F', quantidade: 1, valor2025: 200, valor2026: v26(200) },
  { faces: '1F', quantidade: 2, valor2025: 400, valor2026: v26(400) },
  { faces: '1F', quantidade: 3, valor2025: 575, valor2026: v26(575) },
  { faces: '1F', quantidade: 4, valor2025: 725, valor2026: v26(725) },
  { faces: '1F', quantidade: 5, valor2025: 850, valor2026: v26(850) },
  { faces: '2F', quantidade: 1, valor2025: 250, valor2026: v26(250) },
  { faces: '2F', quantidade: 2, valor2025: 450, valor2026: v26(450) },
  { faces: '2F', quantidade: 3, valor2025: 625, valor2026: v26(625) },
  { faces: '2F', quantidade: 4, valor2025: 775, valor2026: v26(775) },
  { faces: '2F', quantidade: 5, valor2025: 900, valor2026: v26(900) },
  { faces: '3F', quantidade: 1, valor2025: 300, valor2026: v26(300) },
  { faces: '3F', quantidade: 2, valor2025: 550, valor2026: v26(550) },
  { faces: '3F', quantidade: 3, valor2025: 750, valor2026: v26(750) },
  { faces: '3F', quantidade: 4, valor2025: 925, valor2026: v26(925) },
  { faces: '3F', quantidade: 5, valor2025: 1075, valor2026: v26(1075) },
  { faces: '4F', quantidade: 1, valor2025: 350, valor2026: v26(350) },
  { faces: '4F', quantidade: 2, valor2025: 650, valor2026: v26(650) },
  { faces: '4F', quantidade: 3, valor2025: 900, valor2026: v26(900) },
  { faces: '4F', quantidade: 4, valor2025: 1100, valor2026: v26(1100) },
  { faces: '4F', quantidade: 5, valor2025: 1275, valor2026: v26(1275) },
];

export function getRestauracaoEntry(faces: '1F' | '2F' | '3F' | '4F', quantidade: number): RestauracaoEntry | undefined {
  return restauracaoTable.find(r => r.faces === faces && r.quantidade === quantidade);
}

export function getRestauracaoValue(faces: '1F' | '2F' | '3F' | '4F', quantidade: number, year: '2025' | '2026'): number {
  const entry = getRestauracaoEntry(faces, quantidade);
  if (!entry) return 0;
  return year === '2025' ? entry.valor2025 : entry.valor2026;
}

export function buildRestauracaoNome(faces: '1F' | '2F' | '3F' | '4F', quantidade: number): string {
  if (quantidade === 1) return `Restauração ${faces}`;
  return `Restauração ${faces} Qte ${quantidade}`;
}

export const particularProcedures: Procedure[] = [
  { id: 'urgencia-endo', nome: 'Urgência Endodontica', valor2025: 450, valor2026: 469.44, grupo: 'Endodontia' },
  { id: 'clareamento-consultorio', nome: 'Clareamento Consultório', valor2025: 300, valor2026: 312.96, grupo: 'Clareamento' },
  { id: 'clareamento-caseiro', nome: 'Clareamento Caseiro', valor2025: 350, valor2026: 365.12, grupo: 'Clareamento' },
  { id: 'limpeza-prof-rasg', nome: 'Limpeza (Prof + Rasg)', valor2025: 300, valor2026: 312.96, grupo: 'Limpeza', isLimpeza: true },
  { id: 'profilaxia-raspagem', nome: 'Profilaxia + Raspagem', valor2025: 300, valor2026: 312.96, grupo: 'Limpeza', isLimpeza: true },
  { id: 'profilaxia', nome: 'Profilaxia', valor2025: 200, valor2026: v26(200), grupo: 'Limpeza', isLimpeza: true },
  { id: 'raspagem-supra', nome: 'Raspagem Supragengival', valor2025: 150, valor2026: v26(150), grupo: 'Limpeza' },
  { id: 'raspagem-sub', nome: 'Raspagem Subgengival (por sextante)', valor2025: 180, valor2026: v26(180), grupo: 'Limpeza' },
  { id: 'ulotomia', nome: 'Ulotomia / Ulectomia', valor2025: 200, valor2026: v26(200), grupo: 'Limpeza' },

  { id: 'restauracao-1f', nome: 'Restauração 1F', valor2025: 200, valor2026: v26(200), grupo: 'Restauração', isRestauracao: true },
  { id: 'restauracao-2f', nome: 'Restauração 2F', valor2025: 250, valor2026: v26(250), grupo: 'Restauração', isRestauracao: true },
  { id: 'restauracao-3f', nome: 'Restauração 3F', valor2025: 300, valor2026: v26(300), grupo: 'Restauração', isRestauracao: true },
  { id: 'restauracao-4f', nome: 'Restauração 4F', valor2025: 350, valor2026: v26(350), grupo: 'Restauração', isRestauracao: true },

  { id: 'endo-uni', nome: 'Tratamento Endodôntico Unirradicular', valor2025: 700, valor2026: v26(700), grupo: 'Endodontia' },
  { id: 'endo-bi', nome: 'Tratamento Endodôntico Birradicular', valor2025: 900, valor2026: v26(900), grupo: 'Endodontia' },
  { id: 'endo-multi', nome: 'Tratamento Endodôntico Multirradicular', valor2025: 1100, valor2026: v26(1100), grupo: 'Endodontia' },
  { id: 'retratamento-endo', nome: 'Retratamento Endodôntico', valor2025: 1000, valor2026: v26(1000), grupo: 'Endodontia' },
  { id: 'curativo-endo', nome: 'Curativo Endodôntico', valor2025: 150, valor2026: v26(150), grupo: 'Endodontia' },

  { id: 'clareamento-completo', nome: 'Clareamento Completo (Consultório + Caseiro)', valor2025: 550, valor2026: v26(550), grupo: 'Clareamento' },

  { id: 'exodontia-simples', nome: 'Exodontia Simples', valor2025: 200, valor2026: v26(200), grupo: 'Exodontia' },
  { id: 'exodontia-complexa', nome: 'Exodontia Complexa', valor2025: 350, valor2026: v26(350), grupo: 'Exodontia' },
  { id: 'exodontia-siso', nome: 'Exodontia Siso (por dente)', valor2025: 550, valor2026: v26(550), grupo: 'Exodontia' },
  { id: 'alveolotomia', nome: 'Alveolotomia', valor2025: 450, valor2026: v26(450), grupo: 'Exodontia' },
  { id: 'exodontia-deciduo', nome: 'Exodontia de Dente Decíduo', valor2025: 150, valor2026: v26(150), grupo: 'Exodontia' },

  { id: 'cimentacao-coroa', nome: 'Cimentação de Coroa', valor2025: 200, valor2026: v26(200), grupo: 'Prótese' },
  { id: 'cimentacao-pino', nome: 'Cimentação de Pino / Núcleo', valor2025: 180, valor2026: v26(180), grupo: 'Prótese' },
  { id: 'ajuste-protese', nome: 'Ajuste de Prótese', valor2025: 150, valor2026: v26(150), grupo: 'Prótese' },
  { id: 'reparo-protese', nome: 'Reparo de Prótese', valor2025: 180, valor2026: v26(180), grupo: 'Prótese' },

  { id: 'gengivoplastia', nome: 'Gengivoplastia (por elemento)', valor2025: 280, valor2026: v26(280), grupo: 'Periodontia' },
  { id: 'frenectomia', nome: 'Frenectomia', valor2025: 350, valor2026: v26(350), grupo: 'Periodontia' },
  { id: 'curetagem', nome: 'Curetagem (por sextante)', valor2025: 180, valor2026: v26(180), grupo: 'Periodontia' },
  { id: 'cirurgia-periapical', nome: 'Cirurgia Periapical (Apicectomia)', valor2025: 700, valor2026: v26(700), grupo: 'Periodontia' },

  { id: 'mant-orto', nome: 'Manutenção Ortodôntica', valor2025: 130, valor2026: v26(130), grupo: 'Ortodontia' },
  { id: 'contencao', nome: 'Contenção Ortodôntica', valor2025: 280, valor2026: v26(280), grupo: 'Ortodontia' },

  { id: 'rx-periapical', nome: 'Radiografia Periapical', valor2025: 50, valor2026: v26(50), grupo: 'Diagnóstico' },
  { id: 'rx-panoramica', nome: 'Radiografia Panorâmica', valor2025: 120, valor2026: v26(120), grupo: 'Diagnóstico' },
  { id: 'tomografia', nome: 'Tomografia Computadorizada', valor2025: 380, valor2026: v26(380), grupo: 'Diagnóstico' },
  { id: 'consulta-avaliacao', nome: 'Consulta / Avaliação', valor2025: 120, valor2026: v26(120), grupo: 'Diagnóstico' },
  { id: 'urgencia-odonto', nome: 'Urgência Odontológica', valor2025: 150, valor2026: v26(150), grupo: 'Diagnóstico' },

  { id: 'botox-dental', nome: 'Botox Dental (DTM)', valor2025: 1100, valor2026: v26(1100), grupo: 'HOF' },
  { id: 'placa-oclusal', nome: 'Placa Oclusal', valor2025: 750, valor2026: v26(750), grupo: 'HOF' },
  { id: 'bichectomia', nome: 'Bichectomia', valor2025: 1400, valor2026: v26(1400), grupo: 'HOF' },
  { id: 'preenchimento-labial', nome: 'Preenchimento Labial', valor2025: 600, valor2026: 625.92, grupo: 'HOF' },

  { id: 'selante', nome: 'Selante de Fóssulas e Fissuras', valor2025: 110, valor2026: v26(110), grupo: 'Prevenção' },
  { id: 'dessensibilizacao', nome: 'Dessensibilização Dentinária', valor2025: 90, valor2026: v26(90), grupo: 'Prevenção' },
  { id: 'fluorterapia', nome: 'Aplicação de Flúor', valor2025: 80, valor2026: v26(80), grupo: 'Prevenção' },

  { id: 'carie-dentina', nome: 'Tratamento de Cárie (Dentina)', valor2025: 180, valor2026: v26(180), grupo: 'Restauração' },
  { id: 'ionometro-vitreo', nome: 'Restauração Ionomero de Vidro', valor2025: 160, valor2026: v26(160), grupo: 'Restauração' },

  { id: 'faceta-resina', nome: 'Faceta de Resina', valor2025: 450, valor2026: v26(450), grupo: 'Estética' },
  { id: 'microabrasao', nome: 'Microabrasão do Esmalte', valor2025: 250, valor2026: v26(250), grupo: 'Estética' },
  { id: 'diastema-resina', nome: 'Fechamento de Diastema (Resina)', valor2025: 300, valor2026: v26(300), grupo: 'Estética' },
  { id: 'reconstrucao-dente', nome: 'Reconstrução de Dente Fraturado', valor2025: 350, valor2026: v26(350), grupo: 'Restauração' },
];
