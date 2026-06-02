import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { BrandLogoIcon } from '@/components/BrandLogo';
import {
  Shield, TrendingUp, Truck, CheckCircle, Star,
  Database, Zap, Building2, Bell, ArrowRight,
  BarChart3, Search, Award, FileText,
} from 'lucide-react';

const metrics = [
  { value: '500+', label: 'Empresas Ativas' },
  { value: '50k+', label: 'Fornecedores Verificados' },
  { value: '99,9%', label: 'Uptime Garantido' },
  { value: '4.9/5', label: 'Avaliação dos Clientes' },
];

const features = [
  {
    icon: Shield, color: 'blue',
    title: 'Compliance ANVISA',
    desc: 'Verificação automática do status de regularização junto à ANVISA. Evite fornecedores suspensos ou irregulares em tempo real.',
  },
  {
    icon: TrendingUp, color: 'green',
    title: 'Saúde Fiscal',
    desc: 'Dados da Receita Federal em tempo real. Conheça a situação cadastral e o histórico empresarial de cada fornecedor.',
  },
  {
    icon: Bell, color: 'yellow',
    title: 'Alertas Automáticos',
    desc: 'Receba notificações via WhatsApp quando um fornecedor mudar de status na ANVISA. Nunca seja pego de surpresa.',
  },
  {
    icon: BarChart3, color: 'purple',
    title: 'Score de Fornecedor',
    desc: 'Score de compliance automático baseado em dados oficiais. Tome decisões de compra com confiança e embasamento.',
  },
  {
    icon: Database, color: 'indigo',
    title: 'Catálogo ANVISA',
    desc: 'Acesse o catálogo completo de produtos cosméticos e medicamentos registrados na ANVISA, atualizado toda semana.',
  },
  {
    icon: Truck, color: 'orange',
    title: 'Inteligência Logística',
    desc: 'Estimativas de frete e prazo de entrega. Otimize sua cadeia de suprimentos e reduza custos operacionais.',
  },
];

const colorMap: Record<string, string> = {
  blue:   'bg-blue-100   dark:bg-blue-900/30   text-blue-600   dark:text-blue-400',
  green:  'bg-green-100  dark:bg-green-900/30  text-green-600  dark:text-green-400',
  yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
  purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  indigo: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
  orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
};

const steps = [
  {
    icon: Search,
    title: 'Insira o CNPJ',
    desc: 'Digite o CNPJ do fornecedor que deseja avaliar. Qualquer empresa registrada no Brasil.',
  },
  {
    icon: Database,
    title: 'Consultamos as fontes oficiais',
    desc: 'Cruzamos dados da ANVISA, Receita Federal e Diário Oficial em segundos.',
  },
  {
    icon: FileText,
    title: 'Receba o relatório completo',
    desc: 'Score de compliance, status ANVISA, saúde fiscal e alertas — tudo em uma tela.',
  },
];

const trustCards = [
  { bg: 'bg-blue-600',   icon: Shield,    title: 'Dados Oficiais ANVISA',         desc: 'Base pública sincronizada toda semana' },
  { bg: 'bg-green-600',  icon: Building2, title: 'Receita Federal em Tempo Real',  desc: 'Situação cadastral atualizada a cada consulta' },
  { bg: 'bg-purple-600', icon: Zap,       title: 'Diário Oficial da União',        desc: 'Inteligência DOU para detectar riscos antes da concorrência' },
  { bg: 'bg-yellow-500', icon: Bell,      title: 'Alertas via WhatsApp',           desc: 'Notificações automáticas quando o status muda' },
];

const testimonials = [
  {
    quote: 'O Data Control transformou nossa operação. Hoje homologamos fornecedores em minutos e temos total confiança na compliance.',
    name: 'Maria Silva', role: 'Gerente de Compras', company: 'Salão Premium SP',
  },
  {
    quote: 'Antes levávamos 3 dias para homologar um fornecedor. Agora fazemos em menos de 2 minutos. Indispensável para nossa rede.',
    name: 'Ricardo Mendes', role: 'Diretor de Suprimentos', company: 'Rede Farma Nordeste',
  },
  {
    quote: 'Os alertas automáticos via WhatsApp me salvaram de comprar de um fornecedor suspenso pela ANVISA. Vale cada centavo.',
    name: 'Camila Torres', role: 'Compradora', company: 'Distribuidora Bella Vista',
  },
];

const faqs = [
  {
    q: 'De onde vêm os dados de compliance?',
    a: 'Integramos diretamente com as bases públicas da ANVISA, Receita Federal e Diário Oficial da União. Todos os dados são oficiais e atualizados continuamente.',
  },
  {
    q: 'Com que frequência os dados são atualizados?',
    a: 'Os dados da ANVISA são sincronizados toda semana. Os dados da Receita Federal são consultados em tempo real a cada avaliação.',
  },
  {
    q: 'Funciona para cosméticos e medicamentos?',
    a: 'Sim. A plataforma suporta empresas do setor de cosméticos, medicamentos ou ambos. O filtro é configurado no momento do cadastro da sua empresa.',
  },
  {
    q: 'Posso receber alertas quando um fornecedor mudar de status?',
    a: 'Sim. O plano Enterprise inclui alertas automáticos via WhatsApp sempre que um fornecedor da sua lista alterar o status na ANVISA.',
  },
  {
    q: 'Há integração com outros sistemas (ERP, etc.)?',
    a: 'O plano Enterprise inclui acesso à API REST para integração com ERPs, sistemas de compras e qualquer software da sua operação.',
  },
  {
    q: 'Como funciona o pagamento?',
    a: 'O pagamento é feito via Pix, de forma instantânea e 100% dentro da plataforma. Após a confirmação, o acesso é liberado automaticamente.',
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 transition-colors duration-300">
      <Navbar />

      {/* ── HERO ──────────────────────────────────────────────────────────────── */}
      <section className="pt-20 pb-28 bg-gradient-to-br from-slate-50 via-blue-50/40 to-slate-50 dark:from-slate-950 dark:via-blue-900/10 dark:to-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">

            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-semibold mb-7 border border-blue-200 dark:border-blue-800">
              <Award className="h-4 w-4" />
              Plataforma Nº1 de Compliance para Cosméticos e Farmacêuticos
            </div>

            <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 dark:text-white mb-5 leading-tight tracking-tight">
              Homologação de Fornecedores em{' '}
              <span className="text-blue-600">Segundos</span>
            </h1>

            <p className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-4 tracking-widest uppercase">
              Cosméticos · Medicamentos · Compliance ANVISA
            </p>

            <p className="text-xl text-slate-600 dark:text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              O hub definitivo de compliance, procuradoria e inteligência regulatória
              para compradores profissionais do setor de saúde e beleza.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-bold text-lg shadow-lg shadow-blue-500/25 active:scale-95"
              >
                Assinar via Pix <ArrowRight className="h-5 w-5" />
              </Link>
              <button className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:border-blue-400 dark:hover:border-blue-600 transition font-bold text-lg">
                Ver Demonstração
              </button>
            </div>

            <p className="text-sm text-slate-500 dark:text-slate-500">
              ✓ Pagamento via Pix &nbsp;·&nbsp; ✓ Acesso imediato &nbsp;·&nbsp; ✓ Cancele quando quiser
            </p>
          </div>
        </div>
      </section>

      {/* ── METRICS STRIP ─────────────────────────────────────────────────────── */}
      <section className="bg-slate-900 dark:bg-slate-950 border-y border-slate-800 py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {metrics.map((m) => (
              <div key={m.label}>
                <p className="text-3xl md:text-4xl font-extrabold text-white mb-1">{m.value}</p>
                <p className="text-slate-400 text-sm font-medium">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────────────────── */}
      <section id="features" className="py-24 bg-white dark:bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
              Tudo que você precisa em um só lugar
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Decisões mais rápidas, seguras e embasadas para sua operação de compras
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="group p-8 bg-slate-50 dark:bg-slate-900/50 rounded-2xl hover:shadow-lg dark:hover:shadow-blue-900/10 transition border border-transparent hover:border-slate-200 dark:border-slate-800 dark:hover:border-slate-700"
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${colorMap[f.color]}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                    {f.title}
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────────── */}
      <section className="py-24 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Como funciona</h2>
            <p className="text-xl text-slate-400 max-w-xl mx-auto">
              Em menos de 2 minutos você tem o relatório completo do seu fornecedor
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="relative text-center px-4">
                  <div className="w-20 h-20 bg-blue-600/20 border border-blue-500/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Icon className="h-9 w-9 text-blue-400" />
                  </div>
                  <div className="absolute top-0 left-1/2 -translate-x-8 w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-xs font-extrabold">
                    {i + 1}
                  </div>
                  <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                  <p className="text-slate-400 leading-relaxed">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── WHY DATA CONTROL ──────────────────────────────────────────────────── */}
      <section className="py-24 bg-slate-50 dark:bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-8">
                Por que escolher o Data Control?
              </h2>
              <div className="space-y-5">
                {[
                  { title: 'Economia de tempo', desc: 'Reduza de horas para segundos o processo de homologação de fornecedores.' },
                  { title: 'Mitigação de riscos', desc: 'Evite problemas legais e reputacionais com fornecedores irregulares na ANVISA.' },
                  { title: 'Decisões baseadas em dados', desc: 'Scores de qualidade e compliance em tempo real, sem achismos.' },
                  { title: 'Alertas proativos', desc: 'Saiba imediatamente quando um fornecedor muda de status — antes de fazer o pedido.' },
                ].map((b) => (
                  <div key={b.title} className="flex items-start space-x-4">
                    <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                      <strong className="text-slate-900 dark:text-white">{b.title}:</strong> {b.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {trustCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.title} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
                    <div className={`w-12 h-12 ${card.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{card.title}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{card.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ──────────────────────────────────────────────────────── */}
      <section className="py-24 bg-white dark:bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
              Quem já usa, recomenda
            </h2>
            <div className="flex items-center justify-center gap-1 mt-3">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-6 w-6 text-yellow-400" fill="currentColor" />
              ))}
              <span className="ml-2 text-slate-600 dark:text-slate-400 font-semibold">4.9/5 de média</span>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 flex flex-col">
                <div className="flex gap-1 mb-5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 text-yellow-400" fill="currentColor" />
                  ))}
                </div>
                <p className="text-slate-700 dark:text-slate-300 italic leading-relaxed flex-1 mb-6">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">{t.name}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t.role} · {t.company}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────────── */}
      <section className="py-24 bg-slate-50 dark:bg-slate-900/30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
              Perguntas frequentes
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-400">
              Tudo que você precisa saber antes de começar
            </p>
          </div>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <div key={faq.q} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                <h3 className="font-bold text-slate-900 dark:text-white mb-3 text-lg">{faq.q}</h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ───────────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 bg-white dark:bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
              Planos para todos os tamanhos
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-400">
              Pagamento via Pix, acesso imediato após confirmação.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">

            {/* Pro */}
            <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl p-8 hover:shadow-xl dark:hover:shadow-blue-900/10 transition">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Pro</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">Para salões e clínicas de médio porte</p>
              <div className="mb-8">
                <span className="text-5xl font-extrabold text-slate-900 dark:text-white">R$ 147</span>
                <span className="text-slate-500 dark:text-slate-400">/mês</span>
              </div>
              <ul className="space-y-3 mb-8">
                {['Até 50 consultas/mês', 'Acesso completo ao banco de dados ANVISA', 'Score de compliance automático', 'Catálogo ANVISA completo', 'Suporte por email'].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <span className="text-slate-700 dark:text-slate-300 text-sm">{item}</span>
                  </li>
                ))}
              </ul>
              <Link href="/checkout?plano=pro" className="block w-full py-3 text-center bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-bold">
                Assinar via Pix — R$ 147/mês
              </Link>
            </div>

            {/* Enterprise */}
            <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-8 text-white relative overflow-hidden hover:shadow-2xl transition shadow-xl shadow-blue-500/20">
              <div className="absolute top-5 right-5 bg-yellow-400 text-slate-900 px-3 py-1 rounded-full text-xs font-extrabold tracking-wide">
                MAIS POPULAR
              </div>
              <h3 className="text-2xl font-bold mb-1">Enterprise</h3>
              <p className="text-blue-200 mb-6 text-sm">Para distribuidores e grandes redes</p>
              <div className="mb-8">
                <span className="text-5xl font-extrabold">R$ 497</span>
                <span className="text-blue-200">/mês</span>
              </div>
              <ul className="space-y-3 mb-8">
                {['Consultas ilimitadas', 'Alertas automáticos via WhatsApp', 'API REST para integração com ERP', 'Score de compliance + IA', 'Suporte prioritário 24/7', 'Gerente de conta dedicado'].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-blue-200 flex-shrink-0" />
                    <span className="text-sm">{item}</span>
                  </li>
                ))}
              </ul>
              <Link href="/checkout?plano=enterprise" className="block w-full py-3 text-center bg-white text-blue-700 rounded-xl hover:bg-blue-50 transition font-bold">
                Assinar via Pix — R$ 497/mês
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* ── CTA BANNER ────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-blue-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-4">
            Comece hoje. Pague via Pix.
          </h2>
          <p className="text-xl text-blue-100 mb-10 max-w-xl mx-auto">
            Mais de 500 empresas já usam o Data Control para tomar decisões de compra com segurança e velocidade.
          </p>
          <Link
            href="/checkout"
            className="inline-flex items-center gap-2 px-10 py-4 bg-white text-blue-700 rounded-xl font-extrabold text-lg hover:bg-blue-50 transition shadow-xl active:scale-95"
          >
            Assinar agora <ArrowRight className="h-5 w-5" />
          </Link>
          <p className="mt-6 text-blue-200 text-sm">
            ✓ Pagamento via Pix &nbsp;·&nbsp; ✓ Acesso imediato &nbsp;·&nbsp; ✓ Cancele quando quiser
          </p>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────────── */}
      <footer className="bg-slate-950 text-white py-16 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
                  <BrandLogoIcon className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-extrabold">Data Control</span>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
                O hub definitivo de compliance e inteligência regulatória para compradores do setor de saúde e beleza.
              </p>
            </div>
            <div>
              <p className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-4">Produto</p>
              <ul className="space-y-2">
                {['Recursos', 'Preços', 'Catálogo ANVISA', 'Alertas'].map((l) => (
                  <li key={l}><a href="#" className="text-slate-400 hover:text-white transition text-sm">{l}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-4">Legal</p>
              <ul className="space-y-2">
                {['Termos de Uso', 'Privacidade', 'Contato'].map((l) => (
                  <li key={l}><a href="#" className="text-slate-400 hover:text-white transition text-sm">{l}</a></li>
                ))}
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 text-center">
            <p className="text-slate-500 text-sm">
              © 2024 Data Control. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
