'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, ArrowLeft, Check, Clock, X, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface ReportItem {
  id: string;
  reporterId: string;
  targetType: 'USER' | 'TEAM' | 'MATCH';
  targetId: string;
  reason: string;
  status: 'PENDING' | 'REVIEWED' | 'RESOLVED' | 'DISMISSED';
  createdAt: string;
  reporter: {
    id: string;
    nickname: string;
    steamId: string;
    avatarUrl: string;
  };
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('PENDING');

  const fetchReports = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);

      const res = await fetch(`/api/admin/reports?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setReports(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [filterStatus]);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/reports/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setReports((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status: newStatus as ReportItem['status'] } : r))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="container py-8 max-w-5xl space-y-6">
      {/* Back and Title */}
      <div className="space-y-2">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Назад в админ-панель</span>
        </Link>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
          <ShieldAlert className="w-7 h-7 text-white" />
          <span>Жалобы и неявки</span>
        </h1>
        <p className="text-xs md:text-sm text-muted-foreground">
          Журнал обращений игроков по поводу неявок (No-Show), токсичности и нарушений регламента лиги
        </p>
      </div>

      {/* Status filter buttons */}
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
        {['PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED', ''].map((st) => (
          <Button
            key={st}
            variant={filterStatus === st ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilterStatus(st)}
            className="text-xs h-8"
          >
            {st === 'PENDING'
              ? 'Ожидают решения'
              : st === 'REVIEWED'
              ? 'На рассмотрении'
              : st === 'RESOLVED'
              ? 'Решено'
              : st === 'DISMISSED'
              ? 'Отклонено'
              : 'Все'}
          </Button>
        ))}
      </div>

      {/* Reports List */}
      {loading ? (
        <div className="py-20 text-center text-muted-foreground animate-pulse text-sm">
          Загрузка жалоб...
        </div>
      ) : reports.length === 0 ? (
        <Card className="border-neutral-800 bg-neutral-900/40 py-16 text-center">
          <p className="text-muted-foreground text-sm">В данной категории жалоб нет</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <Card key={report.id} className="border-neutral-800 bg-neutral-900/80 backdrop-blur shadow-md">
              <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-mono border-neutral-700">
                      Тип: {report.targetType}
                    </Badge>
                    <Badge
                      className={`text-[10px] ${
                        report.status === 'PENDING'
                          ? 'bg-white/10 text-white border-white/20'
                          : report.status === 'RESOLVED'
                          ? 'bg-neutral-800 text-neutral-300 border-neutral-700'
                          : report.status === 'DISMISSED'
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-neutral-800 text-neutral-300'
                      }`}
                    >
                      {report.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono">
                      Цель ID: {report.targetId}
                    </span>
                  </div>

                  <p className="text-sm font-semibold text-foreground">
                    {report.reason}
                  </p>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Заявитель:</span>
                    <span className="font-bold text-foreground">
                      {report.reporter.nickname}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {report.status !== 'RESOLVED' && (
                    <Button
                      size="sm"
                      onClick={() => handleUpdateStatus(report.id, 'RESOLVED')}
                      className="text-xs h-8 bg-emerald-600 hover:bg-emerald-500 gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Решено</span>
                    </Button>
                  )}
                  {report.status !== 'REVIEWED' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUpdateStatus(report.id, 'REVIEWED')}
                      className="text-xs h-8 gap-1"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>В работу</span>
                    </Button>
                  )}
                  {report.status !== 'DISMISSED' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUpdateStatus(report.id, 'DISMISSED')}
                      className="text-xs h-8 text-muted-foreground hover:text-foreground gap-1"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Отклонить</span>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
