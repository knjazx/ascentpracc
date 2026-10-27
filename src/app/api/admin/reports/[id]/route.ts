import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { Role, ReportStatus } from '@prisma/client';
import { z } from 'zod';

const updateReportSchema = z.object({
  status: z.nativeEnum(ReportStatus),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== Role.ADMIN) {
    return NextResponse.json({ success: false, error: 'Доступ запрещен' }, { status: 403 });
  }

  const { id } = params;

  try {
    const body = await request.json();
    const validated = updateReportSchema.parse(body);

    const updated = await prisma.report.update({
      where: { id },
      data: { status: validated.status },
    });

    return NextResponse.json({
      success: true,
      message: 'Статус жалобы обновлен',
      data: updated,
    });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: err.errors[0]?.message || 'Ошибка валидации' },
        { status: 400 }
      );
    }
    console.error('Error updating report:', err);
    return NextResponse.json(
      { success: false, error: 'Не удалось обновить жалобу' },
      { status: 500 }
    );
  }
}
