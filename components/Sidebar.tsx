'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, FileText, Bell, LogOut, User, Building2, Zap, BookOpen, AlertOctagon } from 'lucide-react';
import { BrandLogoIcon } from './BrandLogo';
import { supabase } from '@/lib/supabase';
import { ThemeToggle } from './ThemeToggle';

const navigation = [
  { name: 'Buscar Fornecedores', href: '/dashboard', icon: Search },
  { name: 'Catálogo ANVISA', href: '/dashboard/catalogo', icon: BookOpen },
  { name: 'Inteligência DOU', href: '/dashboard/inteligencia', icon: Zap },
  { name: 'Fornecedores Analisados', href: '/dashboard/materiais', icon: FileText },
  { name: 'Produtos Irregulares', href: '/dashboard/irregulares', icon: AlertOctagon },
  { name: 'Alertas', href: '/dashboard/alertas', icon: Bell },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user || null);

        // Busca o perfil da empresa do usuário
        if (!session?.user?.id) return;
        const response = await fetch(`/api/fornecedores?userId=${session.user.id}&onlyPerfil=true`);
        if (response.ok) {
          const data = await response.json();
          if (data.fornecedores && data.fornecedores.length > 0) {
            setCompany(data.fornecedores[0]);
          }
        }
      } catch (error) {
        console.error('Erro ao buscar dados do usuário/empresa:', error);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="w-64 bg-slate-900 dark:bg-slate-950 min-h-screen fixed left-0 top-0 border-r border-slate-800 flex flex-col">
      {/* Logo & Company */}
      <div className="p-6 border-b border-slate-800 space-y-4">
        <Link href="/dashboard" className="flex items-center space-x-2">
          <BrandLogoIcon className="h-8 w-8 text-blue-400" />
          <span className="text-xl font-bold text-white tracking-tight">Data Control</span>
        </Link>
        
        {company && (
          <div className="bg-blue-600/10 border border-blue-500/20 rounded-xl p-3 flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <div className="overflow-hidden">
              <p className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">Empresa Logada</p>
              <p className="text-sm font-bold text-white truncate">{company.nome_fantasia || company.razao_social}</p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-2 flex-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span className="font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Theme and User Section */}
      <div className="border-t border-slate-800 p-4 space-y-4">
        <div className="flex items-center justify-between px-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Aparência</span>
          <ThemeToggle />
        </div>

        <div className="flex items-center justify-between bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
          <Link href="/dashboard/perfil" className="flex items-center space-x-3 group hover:opacity-80 transition-opacity flex-1 overflow-hidden">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white ring-2 ring-transparent group-hover:ring-blue-500/30 transition-all">
              <User className="h-5 w-5" />
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-white truncate w-24">
                {user?.user_metadata?.name || user?.email?.split('@')[0] || 'Carregando...'}
              </p>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">Dados Cadastrais</p>
            </div>
          </Link>
          <Link 
            href="/logout"
            className="p-1.5 text-slate-400 hover:text-red-400 transition-colors ml-2"
            title="Sair"
          >
            <LogOut className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

