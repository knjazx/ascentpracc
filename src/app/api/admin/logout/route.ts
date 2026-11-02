import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const ADMIN_COOKIE_NAME = 'ascent_admin_token';

export async function POST() {
  const cookieStore = cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);

  return NextResponse.json({
    success: true,
    message: 'Вы успешно вышли из панели администратора',
  });
}
