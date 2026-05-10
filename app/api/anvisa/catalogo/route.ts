import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = (searchParams.get('q') || '').trim();
  const campo = searchParams.get('campo') || 'nome'; // cnpj | nome | processo | registro
  const tipo = searchParams.get('tipo') || 'todos';  // todos | cosmetico | medicamento
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = 25;
  const offset = (page - 1) * limit;

  if (!q || q.length < 3) {
    return NextResponse.json({ error: 'Mínimo 3 caracteres' }, { status: 400 });
  }

  try {
    const buildQuery = async (table: string, col: string, op: 'eq' | 'ilike', val: any) => {
      let query = supabaseAdmin.from(table).select('*', { count: 'exact' });
      if (op === 'eq') query = query.eq(col, val);
      if (op === 'ilike') query = query.ilike(col, `%${val}%`);
      const { data, count } = await query.range(offset, offset + limit - 1);
      return { documents: data || [], total: count || 0 };
    };

    let cosmeticosResult: any = { documents: [], total: 0 };
    let medicamentosResult: any = { documents: [], total: 0 };

    const cnpjLimpo = q.replace(/\D/g, '');

    if (campo === 'cnpj') {
      if (cnpjLimpo.length < 11) {
        return NextResponse.json({ error: 'CNPJ deve ter ao menos 11 dígitos' }, { status: 400 });
      }
      if (tipo !== 'medicamento') cosmeticosResult = await buildQuery('anvisa_cosmeticos', 'cnpj', 'eq', cnpjLimpo);
      if (tipo !== 'cosmetico') medicamentosResult = await buildQuery('anvisa_medicamentos', 'cnpj', 'eq', cnpjLimpo);

    } else if (campo === 'registro') {
      if (tipo !== 'medicamento') cosmeticosResult = await buildQuery('anvisa_cosmeticos', 'registro', 'eq', q);
      if (tipo !== 'cosmetico') medicamentosResult = await buildQuery('anvisa_medicamentos', 'registro', 'eq', q);

    } else if (campo === 'processo') {
      if (tipo !== 'medicamento') cosmeticosResult = await buildQuery('anvisa_cosmeticos', 'processo', 'eq', q);
      if (tipo !== 'cosmetico') medicamentosResult = await buildQuery('anvisa_medicamentos', 'processo', 'eq', q);

    } else {
      // nome — fulltext
      if (tipo !== 'medicamento') cosmeticosResult = await buildQuery('anvisa_cosmeticos', 'nome_produto', 'ilike', q);
      if (tipo !== 'cosmetico') medicamentosResult = await buildQuery('anvisa_medicamentos', 'nome_produto', 'ilike', q);
    }

    const mapDoc = (d: any, tipo: 'cosmetico' | 'medicamento') => ({
      id: d.id,
      $id: d.id, // Retro-compatibility for frontend
      tipo,
      cnpj: d.cnpj,
      razao_social: d.razao_social,
      nome_produto: d.nome_produto,
      processo: d.processo,
      registro: d.registro || '',
      situacao: d.situacao || '',
      principio_ativo: d.principio_ativo || '',
      vencimento: d.vencimento,
      seguro_compra: d.seguro_compra,
    });

    const resultados = [
      ...(cosmeticosResult.documents as any[]).map((d: any) => mapDoc(d, 'cosmetico')),
      ...(medicamentosResult.documents as any[]).map((d: any) => mapDoc(d, 'medicamento')),
    ];

    return NextResponse.json({
      resultados,
      total: cosmeticosResult.total + medicamentosResult.total,
      pagina: page,
      por_pagina: limit,
      cosmeticos_total: cosmeticosResult.total,
      medicamentos_total: medicamentosResult.total,
    });
  } catch (err: any) {
    console.error('[GET /api/anvisa/catalogo]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
