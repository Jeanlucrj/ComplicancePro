import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { Shield, TrendingUp, Truck, CheckCircle, Star } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 transition-colors duration-300">
      <Navbar />

      {/* Hero Section */}
      <section className="pt-20 pb-24 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-blue-900/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-5xl md:text-6xl font-bold text-slate-900 dark:text-white mb-4 leading-tight">
              Homologação de Fornecedores em{' '}
              <span className="text-blue-600">Segundos</span>
            </h1>
            <p className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-4 tracking-wide uppercase">
              Cosméticos · Medicamentos · Compliance ANVISA
            </p>
            <p className="text-xl text-slate-600 dark:text-slate-400 mb-8">
              O hub definitivo de compliance, procuradoria e inteligência regulatória
              para compradores profissionais do setor de saúde e beleza.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/dashboard"
                className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold text-lg"
              >
                Começar Agora
              </Link>
              <button className="px-8 py-4 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-2 border-slate-300 dark:border-slate-700 rounded-lg hover:border-slate-400 dark:hover:border-slate-500 transition font-semibold text-lg">
                Agendar Demo
              </button>
            </div>
            <p className="mt-6 text-sm text-slate-500">
              Teste grátis por 14 dias. Sem cartão de crédito.
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white dark:bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
              Tudo que você precisa em um só lugar
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-400">
              Decisões mais rápidas e seguras para sua operação
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-8 bg-slate-50 dark:bg-slate-900/50 rounded-2xl hover:shadow-lg dark:hover:shadow-blue-900/10 transition border border-transparent dark:border-slate-800">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
                Compliance Anvisa
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                Verificação automática do status de regularização junto à Anvisa.
                Evite fornecedores suspensos ou irregulares.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-8 bg-slate-50 dark:bg-slate-900/50 rounded-2xl hover:shadow-lg dark:hover:shadow-blue-900/10 transition border border-transparent dark:border-slate-800">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mb-4">
                <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
                Saúde Fiscal
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                Dados da Receita Federal em tempo real. Conheça a situação
                cadastral e o histórico empresarial de cada fornecedor.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-8 bg-slate-50 dark:bg-slate-900/50 rounded-2xl hover:shadow-lg dark:hover:shadow-blue-900/10 transition border border-transparent dark:border-slate-800">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mb-4">
                <Truck className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
                Inteligência Logística
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                Estimativas de frete e prazo de entrega. Otimize sua cadeia de
                suprimentos e reduza custos operacionais.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-slate-50 dark:bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-6">
                Por que escolher o CompliancePro?
              </h2>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-500 mt-1 flex-shrink-0" />
                  <p className="text-slate-700 dark:text-slate-300">
                    <strong>Economia de tempo:</strong> Reduza de horas para
                    segundos o processo de homologação
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-500 mt-1 flex-shrink-0" />
                  <p className="text-slate-700 dark:text-slate-300">
                    <strong>Mitigação de riscos:</strong> Evite problemas legais
                    com fornecedores irregulares
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-500 mt-1 flex-shrink-0" />
                  <p className="text-slate-700 dark:text-slate-300">
                    <strong>Decisões baseadas em dados:</strong> Scores de
                    qualidade e compliance em tempo real
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-500 mt-1 flex-shrink-0" />
                  <p className="text-slate-700 dark:text-slate-300">
                    <strong>Otimização logística:</strong> Encontre fornecedores
                    próximos e reduza custos de frete
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl dark:shadow-blue-900/10 border dark:border-slate-800">
              <div className="text-center mb-6">
                <Star className="h-12 w-12 text-yellow-500 mx-auto mb-3" />
                <p className="text-2xl font-bold text-slate-900 dark:text-white">4.9/5.0</p>
                <p className="text-slate-600 dark:text-slate-400">Avaliação média dos clientes</p>
              </div>
              <div className="border-t dark:border-slate-800 pt-6">
                <p className="text-slate-700 dark:text-slate-300 italic mb-4">
                  "O CompliancePro transformou nossa operação. Hoje homologamos
                  fornecedores em minutos e temos total confiança na compliance."
                </p>
                <p className="font-semibold text-slate-900 dark:text-white">
                  Maria Silva
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Gerente de Compras - Salão Premium SP
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-white dark:bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
              Planos para todos os tamanhos de negócio
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-400">
              Escolha o plano ideal para suas necessidades
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Plano Pro */}
            <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl p-8 hover:shadow-xl dark:hover:shadow-blue-900/10 transition">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Pro</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                Para salões e clínicas de médio porte
              </p>
              <div className="mb-6">
                <span className="text-5xl font-bold text-slate-900 dark:text-white">R$ 147</span>
                <span className="text-slate-600 dark:text-slate-400">/mês</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-700 dark:text-slate-300">Até 50 consultas/mês</span>
                </li>
                <li className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-700 dark:text-slate-300">
                    Acesso completo ao banco de dados
                  </span>
                </li>
                <li className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-700 dark:text-slate-300">
                    Estimativas de frete ilimitadas
                  </span>
                </li>
                <li className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-700 dark:text-slate-300">Suporte por email</span>
                </li>
              </ul>
              <button className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold">
                Começar Teste Grátis
              </button>
            </div>

            {/* Plano Enterprise */}
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-900 rounded-2xl p-8 text-white relative overflow-hidden hover:shadow-2xl transition transition-colors duration-300">
              <div className="absolute top-4 right-4 bg-yellow-400 text-slate-900 px-3 py-1 rounded-full text-xs font-bold">
                POPULAR
              </div>
              <h3 className="text-2xl font-bold mb-2">Enterprise</h3>
              <p className="text-blue-100 mb-6">
                Para distribuidores e grandes redes
              </p>
              <div className="mb-6">
                <span className="text-5xl font-bold">R$ 497</span>
                <span className="text-blue-100">/mês</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-blue-200 mt-0.5 flex-shrink-0" />
                  <span>Consultas ilimitadas</span>
                </li>
                <li className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-blue-200 mt-0.5 flex-shrink-0" />
                  <span>API para integração</span>
                </li>
                <li className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-blue-200 mt-0.5 flex-shrink-0" />
                  <span>Alertas automáticos de compliance</span>
                </li>
                <li className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-blue-200 mt-0.5 flex-shrink-0" />
                  <span>Suporte prioritário 24/7</span>
                </li>
                <li className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-blue-200 mt-0.5 flex-shrink-0" />
                  <span>Gerente de conta dedicado</span>
                </li>
              </ul>
              <button className="w-full py-3 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition font-semibold">
                Falar com Vendas
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-slate-400">
              © 2024 CompliancePro. Todos os direitos reservados.
            </p>
            <div className="mt-4 space-x-6">
              <a href="#" className="text-slate-400 hover:text-white transition">
                Termos de Uso
              </a>
              <a href="#" className="text-slate-400 hover:text-white transition">
                Privacidade
              </a>
              <a href="#" className="text-slate-400 hover:text-white transition">
                Contato
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
