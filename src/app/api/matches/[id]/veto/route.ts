import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getVetoState, startVeto, processVetoAction } from '@/lib/veto/state-machine';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 });
  }

  const { id: matchId } = params;
  const state = await getVetoState(matchId);

  return NextResponse.json({ success: true, data: state });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 });
  }

  const { id: matchId } = params;

  try {
    const body = await request.json();
    const { action, map, side } = body;

    if (action === 'start') {
      const state = await startVeto(matchId);
      return NextResponse.json({ success: true, data: state });
    }

    if (action === 'action') {
      const state = await processVetoAction(matchId, user.id, { map, side });
      return NextResponse.json({ success: true, data: state });
    }

    return NextResponse.json({ success: false, error: 'Неизвестное действие' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Ошибка обработки вето';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
