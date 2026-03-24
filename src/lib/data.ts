// Mock data based on the Excel spreadsheet analysis
// In production, this would come from a database (Prisma + PostgreSQL)

export interface Patient {
  id: number;
  nome: string;
  telefone: string;
  email: string;
  cpf: string;
  dataNascimento: string;
  sexo: string;
  planoSaude: string;
  carterinha: string;
  endereco: string;
  cep: string;
  profissao: string;
  naturalidade: string;
  queixaPrincipal: string;
  alergia: string;
  pressao: string;
  diabetes: string;
  problemaCoracao: string;
  gestante: string;
  fumante: string;
  medicacao: string;
  ultimoTratamento: string;
  atualizado: boolean;
}

export interface Appointment {
  id: number;
  data: string;
  paciente: string;
  planoSaude: string;
  limpeza: boolean;
  pediuRecibo: boolean;
  modalidadePagamento: string;
  parcelas: number;
  procedimentosParticular: string;
  procedimentosUniodonto: string;
  procedimentosCamed: string;
  procedimentosGeap: string;
  detalhesDespesa: string;
  descricaoQueixa: string;
}

export interface FinancialRecord {
  id: number;
  data: string;
  paciente: string;
  plano: string;
  pediuRecibo: boolean;
  modalidadePagamento: string;
  parcelas: number;
  orcamento: number;
  custoMaquinaCredito: number;
  inss: number;
  impostoRenda: number;
  custoProcedimento: number;
  resultadoLiquido: number;
  margemOperacional: number;
}

export interface StockItem {
  id: number;
  insumo: string;
  link: string;
  usosPorVez: number;
  loteProduto: number;
  estoqueContado: number;
  estoqueReal: number;
  validade: string;
  renovou: boolean;
  mesesAteValidade: number;
  quantidadeUsadasHistoria: number;
}

export interface ReturnPatient {
  id: number;
  paciente: string;
  planoSaude: string;
  limpeza: number;
  tempoUltimaLimpeza: string;
  inativo: boolean;
  telefone: string;
  whatsappLink: string;
  textoWhatsapp: string;
  idade: number;
  semanasAteAniversario: number;
}

// Sample data from the Excel file
export const samplePatients: Patient[] = [
  {
    id: 1,
    nome: 'Wilmar Helena de Alencar Cunha Monteiro',
    telefone: '85 988095644',
    email: 'claudiamonteiro2007@hotmail.com',
    cpf: '06062695334',
    dataNascimento: '1934-07-30',
    sexo: 'Feminino',
    planoSaude: 'Geap',
    carterinha: '0903002101150097',
    endereco: 'Rua Dom José Lourenço 426',
    cep: '60450245',
    profissao: 'Aposentada',
    naturalidade: 'Fortaleza',
    queixaPrincipal: 'Canal',
    alergia: 'Iodo',
    pressao: 'Alta',
    diabetes: 'Sim',
    problemaCoracao: 'Não',
    gestante: 'Não',
    fumante: 'Não',
    medicacao: 'Muitas (relação PDF)',
    ultimoTratamento: '3 anos',
    atualizado: false,
  },
  {
    id: 2,
    nome: 'Ana Beatriz Fernandes Ramos',
    telefone: '85 991234567',
    email: 'anabeatriz@gmail.com',
    cpf: '12345678901',
    dataNascimento: '1990-03-15',
    sexo: 'Feminino',
    planoSaude: 'Particular',
    carterinha: '',
    endereco: 'Av. Santos Dumont 1500',
    cep: '60150162',
    profissao: 'Advogada',
    naturalidade: 'Fortaleza',
    queixaPrincipal: 'Clareamento',
    alergia: 'Não',
    pressao: 'Normal',
    diabetes: 'Não',
    problemaCoracao: 'Não',
    gestante: 'Não',
    fumante: 'Não',
    medicacao: 'Não',
    ultimoTratamento: '6 meses',
    atualizado: true,
  },
  {
    id: 3,
    nome: 'Carlos Eduardo Silva Mendes',
    telefone: '85 999876543',
    email: 'carlos.mendes@outlook.com',
    cpf: '98765432100',
    dataNascimento: '1985-11-22',
    sexo: 'Masculino',
    planoSaude: 'Uniodonto',
    carterinha: '5501234567890',
    endereco: 'Rua Pereira Filgueiras 800',
    cep: '60160150',
    profissao: 'Engenheiro',
    naturalidade: 'Fortaleza',
    queixaPrincipal: 'Dor de dente',
    alergia: 'Penicilina',
    pressao: 'Normal',
    diabetes: 'Não',
    problemaCoracao: 'Não',
    gestante: 'Não',
    fumante: 'Não',
    medicacao: 'Não',
    ultimoTratamento: '1 ano',
    atualizado: true,
  },
  {
    id: 4,
    nome: 'Marilia Dantas Oliveira',
    telefone: '85 987654321',
    email: 'marilia.d@gmail.com',
    cpf: '55566677788',
    dataNascimento: '1978-06-10',
    sexo: 'Feminino',
    planoSaude: 'Camed',
    carterinha: '7700998877665',
    endereco: 'Rua Barão de Aracati 1050',
    cep: '60115080',
    profissao: 'Professora',
    naturalidade: 'Fortaleza',
    queixaPrincipal: 'Prótese',
    alergia: 'Não',
    pressao: 'Normal',
    diabetes: 'Não',
    problemaCoracao: 'Sim',
    gestante: 'Não',
    fumante: 'Não',
    medicacao: 'Losartana',
    ultimoTratamento: '2 anos',
    atualizado: false,
  },
  {
    id: 5,
    nome: 'ALDA MARIA DOS SANTOS',
    telefone: '85 996543210',
    email: 'alda.santos@yahoo.com.br',
    cpf: '11122233344',
    dataNascimento: '1960-01-05',
    sexo: 'Feminino',
    planoSaude: 'Particular',
    carterinha: '',
    endereco: 'Av. Abolição 2200',
    cep: '60165080',
    profissao: 'Aposentada',
    naturalidade: 'Fortaleza',
    queixaPrincipal: 'Limpeza',
    alergia: 'Não',
    pressao: 'Alta',
    diabetes: 'Sim',
    problemaCoracao: 'Sim',
    gestante: 'Não',
    fumante: 'Não',
    medicacao: 'Metformina, Atenolol',
    ultimoTratamento: '8 meses',
    atualizado: true,
  },
];

export const sampleAppointments: Appointment[] = [
  { id: 1, data: '2025-03-10', paciente: 'Ana Beatriz Fernandes Ramos', planoSaude: 'Particular', limpeza: true, pediuRecibo: false, modalidadePagamento: 'Pix', parcelas: 1, procedimentosParticular: 'Limpeza (Prof + Rasg), Clareamento Consultório', procedimentosUniodonto: '', procedimentosCamed: '', procedimentosGeap: '', detalhesDespesa: 'Escova robinson, Pasta profilatica, Pedra Pomes', descricaoQueixa: '' },
  { id: 2, data: '2025-03-10', paciente: 'Carlos Eduardo Silva Mendes', planoSaude: 'Uniodonto', limpeza: false, pediuRecibo: false, modalidadePagamento: '', parcelas: 0, procedimentosParticular: '', procedimentosUniodonto: 'Consulta odontológica, Profilaxia', procedimentosCamed: '', procedimentosGeap: '', detalhesDespesa: 'Luva, Gaze, Escova Robinson', descricaoQueixa: 'Dor molar inferior esquerdo' },
  { id: 3, data: '2025-03-11', paciente: 'Marilia Dantas Oliveira', planoSaude: 'Camed', limpeza: false, pediuRecibo: true, modalidadePagamento: '', parcelas: 0, procedimentosParticular: '', procedimentosUniodonto: '', procedimentosCamed: 'Tratamento endodôntico birradicular', procedimentosGeap: '', detalhesDespesa: 'Lima #25, Hipoclorito, Cone de Paper', descricaoQueixa: 'Canal dente 25' },
  { id: 4, data: '2025-03-12', paciente: 'ALDA MARIA DOS SANTOS', planoSaude: 'Particular', limpeza: true, pediuRecibo: false, modalidadePagamento: 'Cartão Débito', parcelas: 1, procedimentosParticular: 'Profilaxia + Raspagem', procedimentosUniodonto: '', procedimentosCamed: '', procedimentosGeap: '', detalhesDespesa: 'Escova Robinson, Pasta, Curetas', descricaoQueixa: '' },
  { id: 5, data: '2025-03-13', paciente: 'Wilmar Helena de Alencar Cunha Monteiro', planoSaude: 'Geap', limpeza: false, pediuRecibo: false, modalidadePagamento: '', parcelas: 0, procedimentosParticular: '', procedimentosUniodonto: '', procedimentosCamed: '', procedimentosGeap: 'CONSULTA ODONTOLÓGICA INICIAL, PACOTE ODONTOLÓGICO PERIODONTAL', detalhesDespesa: 'Luva, Gaze', descricaoQueixa: 'Avaliação para canal' },
];

export const sampleFinancials: FinancialRecord[] = [
  { id: 1, data: '2025-03-10', paciente: 'Ana Beatriz Fernandes Ramos', plano: 'Particular', pediuRecibo: false, modalidadePagamento: 'Pix', parcelas: 1, orcamento: 600, custoMaquinaCredito: 0, inss: 0, impostoRenda: 0, custoProcedimento: 35.73, resultadoLiquido: 564.27, margemOperacional: 0.94 },
  { id: 2, data: '2025-03-10', paciente: 'Carlos Eduardo Silva Mendes', plano: 'Uniodonto', pediuRecibo: false, modalidadePagamento: '', parcelas: 0, orcamento: 0, custoMaquinaCredito: 0, inss: 0, impostoRenda: 0, custoProcedimento: 12.50, resultadoLiquido: -12.50, margemOperacional: 0 },
  { id: 3, data: '2025-03-11', paciente: 'Marilia Dantas Oliveira', plano: 'Camed', pediuRecibo: true, modalidadePagamento: '', parcelas: 0, orcamento: 0, custoMaquinaCredito: 0, inss: 0, impostoRenda: 0, custoProcedimento: 45.90, resultadoLiquido: -45.90, margemOperacional: 0 },
  { id: 4, data: '2025-03-12', paciente: 'ALDA MARIA DOS SANTOS', plano: 'Particular', pediuRecibo: false, modalidadePagamento: 'Cartão Débito', parcelas: 1, orcamento: 350, custoMaquinaCredito: 2.59, inss: 0, impostoRenda: 0, custoProcedimento: 22.00, resultadoLiquido: 325.41, margemOperacional: 0.93 },
  { id: 5, data: '2025-03-13', paciente: 'Wilmar Helena de Alencar Cunha Monteiro', plano: 'Geap', pediuRecibo: false, modalidadePagamento: '', parcelas: 0, orcamento: 0, custoMaquinaCredito: 0, inss: 0, impostoRenda: 0, custoProcedimento: 8.50, resultadoLiquido: -8.50, margemOperacional: 0 },
];

export const sampleStock: StockItem[] = [
  { id: 1, insumo: 'Mepvacaína', link: '#', usosPorVez: 1, loteProduto: 1, estoqueContado: 5, estoqueReal: 3, validade: '2025-08-01', renovou: false, mesesAteValidade: 5, quantidadeUsadasHistoria: 120 },
  { id: 2, insumo: 'Hipoclorito de Sódio 2.5%', link: '#', usosPorVez: 1, loteProduto: 1, estoqueContado: 3, estoqueReal: 2, validade: '2026-01-15', renovou: false, mesesAteValidade: 10, quantidadeUsadasHistoria: 85 },
  { id: 3, insumo: 'Lima #25', link: '#', usosPorVez: 1, loteProduto: 6, estoqueContado: 12, estoqueReal: 8, validade: '2027-03-01', renovou: true, mesesAteValidade: 24, quantidadeUsadasHistoria: 200 },
  { id: 4, insumo: 'Escova Robinson', link: '#', usosPorVez: 1, loteProduto: 12, estoqueContado: 24, estoqueReal: 18, validade: '2026-06-01', renovou: false, mesesAteValidade: 15, quantidadeUsadasHistoria: 350 },
  { id: 5, insumo: 'Pasta Profilática', link: '#', usosPorVez: 1, loteProduto: 1, estoqueContado: 2, estoqueReal: 1, validade: '2025-12-01', renovou: false, mesesAteValidade: 9, quantidadeUsadasHistoria: 150 },
  { id: 6, insumo: 'Luva Procedimento M', link: '#', usosPorVez: 2, loteProduto: 100, estoqueContado: 200, estoqueReal: 150, validade: '2027-01-01', renovou: true, mesesAteValidade: 22, quantidadeUsadasHistoria: 1500 },
  { id: 7, insumo: 'Cone de Paper #25', link: '#', usosPorVez: 3, loteProduto: 120, estoqueContado: 240, estoqueReal: 180, validade: '2028-01-01', renovou: false, mesesAteValidade: 34, quantidadeUsadasHistoria: 400 },
];

export const sampleReturns: ReturnPatient[] = [
  { id: 1, paciente: 'Ana Paula Vaz da Silva', planoSaude: 'Uniodonto', limpeza: 3, tempoUltimaLimpeza: '1 mês e 12 dias', inativo: false, telefone: '558588710287', whatsappLink: 'wa.me//558588710287', textoWhatsapp: 'Olá Ana Paula, tudo bem? 😊\n\nNotamos que já se passou um tempo desde sua última limpeza...', idade: 33, semanasAteAniversario: 25 },
  { id: 2, paciente: 'Carlos Eduardo Silva Mendes', planoSaude: 'Uniodonto', limpeza: 2, tempoUltimaLimpeza: '3 meses e 5 dias', inativo: false, telefone: '558599876543', whatsappLink: 'wa.me//558599876543', textoWhatsapp: 'Olá Carlos, tudo bem? 😊\n\nNotamos que já faz algum tempo...', idade: 39, semanasAteAniversario: 35 },
  { id: 3, paciente: 'Maria José Santos', planoSaude: 'Particular', limpeza: 1, tempoUltimaLimpeza: '6 meses e 2 dias', inativo: false, telefone: '558598765432', whatsappLink: 'wa.me//558598765432', textoWhatsapp: 'Olá Maria José, tudo bem? 😊...', idade: 55, semanasAteAniversario: 12 },
];

// DRE Data
export const dreData = {
  categories: [
    'Procedimento Particular Odonto',
    'Procedimento Uniodonto',
    'Procedimento Camed',
    'Procedimento Geap',
    'Procedimento HOF',
  ],
  months: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
  revenue2025: [500, 900, 2250, 1750, 650, 6800, 500, 2200, 2500, 800, 400, 4000],
  revenue2026: [850, 900, 2250, 1750, 650, 6800, 500, 2200, 2500, 800, 400, 4000],
};

// Analytics DFC (legacy — kept for backward compat)
export const analyticsDFC = {
  months: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
  receita: [0, 0, 3823.48, 5183.5, 1738.94, 11910.19, 8337.42, 6254.57, 9887.88, 5748.7, 8572.86, 11419.69],
  custo: [0, 0, 2191.37, 3000, 1200, 4500, 3800, 2800, 4200, 2500, 3200, 5000],
  lucro: [0, 0, 1632.11, 2183.5, 538.94, 7410.19, 4537.42, 3454.57, 5687.88, 3248.7, 5372.86, 6419.69],
  estruturaCustos: [
    { nome: 'Alimentação', total: 2191.37 },
    { nome: 'Aluguel', total: 18000 },
    { nome: 'Material', total: 8500 },
    { nome: 'INSS', total: 15000 },
    { nome: 'Imposto de Renda', total: 6000 },
    { nome: 'Manutenção', total: 3500 },
  ],
};

export interface MonthlyData {
  receita: number;
  custo: number;
  lucro: number;
  atendimentos: number;
}

export interface YearData {
  year: number;
  months: MonthlyData[];
}

export const analyticsByYear: YearData[] = [
  {
    year: 2023,
    months: [
      { receita: 2100, custo: 1400, lucro: 700, atendimentos: 18 },
      { receita: 2450, custo: 1550, lucro: 900, atendimentos: 20 },
      { receita: 3100, custo: 1800, lucro: 1300, atendimentos: 24 },
      { receita: 2800, custo: 1650, lucro: 1150, atendimentos: 22 },
      { receita: 1900, custo: 1300, lucro: 600, atendimentos: 16 },
      { receita: 5200, custo: 2400, lucro: 2800, atendimentos: 38 },
      { receita: 4800, custo: 2200, lucro: 2600, atendimentos: 35 },
      { receita: 3600, custo: 1900, lucro: 1700, atendimentos: 28 },
      { receita: 6100, custo: 2800, lucro: 3300, atendimentos: 42 },
      { receita: 4200, custo: 2000, lucro: 2200, atendimentos: 32 },
      { receita: 5800, custo: 2600, lucro: 3200, atendimentos: 40 },
      { receita: 7200, custo: 3100, lucro: 4100, atendimentos: 50 },
    ],
  },
  {
    year: 2024,
    months: [
      { receita: 2800, custo: 1600, lucro: 1200, atendimentos: 22 },
      { receita: 3200, custo: 1800, lucro: 1400, atendimentos: 26 },
      { receita: 4100, custo: 2100, lucro: 2000, atendimentos: 30 },
      { receita: 3700, custo: 1950, lucro: 1750, atendimentos: 28 },
      { receita: 2400, custo: 1450, lucro: 950, atendimentos: 19 },
      { receita: 7800, custo: 3200, lucro: 4600, atendimentos: 52 },
      { receita: 6500, custo: 2900, lucro: 3600, atendimentos: 46 },
      { receita: 5100, custo: 2400, lucro: 2700, atendimentos: 38 },
      { receita: 8200, custo: 3500, lucro: 4700, atendimentos: 56 },
      { receita: 5600, custo: 2600, lucro: 3000, atendimentos: 40 },
      { receita: 7100, custo: 3000, lucro: 4100, atendimentos: 50 },
      { receita: 9800, custo: 4000, lucro: 5800, atendimentos: 66 },
    ],
  },
  {
    year: 2025,
    months: [
      { receita: 0, custo: 0, lucro: 0, atendimentos: 0 },
      { receita: 0, custo: 0, lucro: 0, atendimentos: 0 },
      { receita: 3823.48, custo: 2191.37, lucro: 1632.11, atendimentos: 29 },
      { receita: 5183.5, custo: 3000, lucro: 2183.5, atendimentos: 37 },
      { receita: 1738.94, custo: 1200, lucro: 538.94, atendimentos: 14 },
      { receita: 11910.19, custo: 4500, lucro: 7410.19, atendimentos: 72 },
      { receita: 8337.42, custo: 3800, lucro: 4537.42, atendimentos: 58 },
      { receita: 6254.57, custo: 2800, lucro: 3454.57, atendimentos: 46 },
      { receita: 9887.88, custo: 4200, lucro: 5687.88, atendimentos: 64 },
      { receita: 5748.7, custo: 2500, lucro: 3248.7, atendimentos: 41 },
      { receita: 8572.86, custo: 3200, lucro: 5372.86, atendimentos: 58 },
      { receita: 11419.69, custo: 5000, lucro: 6419.69, atendimentos: 74 },
    ],
  },
  {
    year: 2026,
    months: [
      { receita: 4200, custo: 1800, lucro: 2400, atendimentos: 32 },
      { receita: 5600, custo: 2300, lucro: 3300, atendimentos: 42 },
      { receita: 7100, custo: 2900, lucro: 4200, atendimentos: 52 },
      { receita: 0, custo: 0, lucro: 0, atendimentos: 0 },
      { receita: 0, custo: 0, lucro: 0, atendimentos: 0 },
      { receita: 0, custo: 0, lucro: 0, atendimentos: 0 },
      { receita: 0, custo: 0, lucro: 0, atendimentos: 0 },
      { receita: 0, custo: 0, lucro: 0, atendimentos: 0 },
      { receita: 0, custo: 0, lucro: 0, atendimentos: 0 },
      { receita: 0, custo: 0, lucro: 0, atendimentos: 0 },
      { receita: 0, custo: 0, lucro: 0, atendimentos: 0 },
      { receita: 0, custo: 0, lucro: 0, atendimentos: 0 },
    ],
  },
];

export const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Business KPIs per year
export interface BusinessKPIs {
  year: number;
  ticketMedioAnual: number;
  totalAtendimentos: number;
  margemMediaAnual: number;
}

export const businessKPIs: BusinessKPIs[] = [
  { year: 2023, ticketMedioAnual: 182.5, totalAtendimentos: 365, margemMediaAnual: 54.8 },
  { year: 2024, ticketMedioAnual: 218.3, totalAtendimentos: 473, margemMediaAnual: 58.2 },
  { year: 2025, ticketMedioAnual: 241.7, totalAtendimentos: 493, margemMediaAnual: 55.6 },
  { year: 2026, ticketMedioAnual: 265.4, totalAtendimentos: 126, margemMediaAnual: 61.3 },
];
