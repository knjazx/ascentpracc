'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ArrowLeft, CheckCircle2, Ban, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

interface DisputedMatch {
  id: string;
  format: string;
  status: string;
  scheduledAt: string;
  teamA: { id: string; name: string; tag: string };
  teamB: { id: string; name: string; tag: string };
  maps: Array<{
    id: string;
    order: number;
    map: string;
    scoreA_byA?: number | null;
    scoreB_byA?: number | null;
    scoreA_byB?: number | null;
    scoreB_byB?: number | null;
    finalScoreA?: number | null;
    finalScoreB?: number | null;
  }>;
}

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<DisputedMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // Resolution form state keyed by matchId
  const [scores, setScores] = useState<Record<string, Record<string, { a: string; b: string }>>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ matchId: string; type: 'success' | 'error'; text: string } | null>(null);

  const fetchDisputes = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/disputes');
      const data = await res.json();
      if (data.success) {
        setDisputes(data.data);
        // Pre-populate scores
        const initialScores: Record<string, Record<string, { a: string; b: string }>> = {};
        data.data.forEach((m: DisputedMatch) => {
          initialScores[m.id] = {};
          m.maps.forEach((map) => {
            initialScores[m.id][map.id] = {
              a: String(map.scoreA_byA ?? map.scoreA_byB ?? 13),
              b: String(map.scoreB_byA ?? map.scoreB_byB ?? 0),
            };
          });
        });
        setScores(initialScores);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDisputes();
  }, []);

  const handleScoreChange = (matchId: string, mapId: string, side: 'a' | 'b', val: string) => {
    setScores((prev) => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [mapId]: {
          ...prev[matchId]?.[mapId],
          [side]: val,
        },
      },
    }));
  };

  const handleResolve = async (matchId: string, action: 'CONFIRM' | 'CANCEL') => {
    const reason = reasons[matchId]?.trim();
    if (!reason) {
      alert('Укажите причину и судейский вердикт!');
      return;
    }

    const match = disputes.find((d) => d.id === matchId);
    if (!match) return;

    setResolvingId(matchId);
    setMsg(null);

    try {
      const payloadMaps =
        action === 'CONFIRM'
          ? match.maps.map((m) => ({
              mapId: m.id,
              finalScoreA: parseInt(scores[matchId]?.[m.id]?.a || '13', 10),
              finalScoreB: parseInt(scores[matchId]?.[m.id]?.b || '0', 10),
            }))
          : undefined;

      const res = await fetch(`/api/admin/disputes/${matchId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          reason,
          maps: payloadMaps,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка разрешения спора');
      }

      setMsg({ matchId, type: 'success', text: data.message });
      await fetchDisputes();
    } catch (err: unknown) {
      setMsg({
        matchId,
        type: 'error',
        text: err instanceof Error ? err.message : 'Ошибка при вынесении решения',
      });
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="container py-8 max-w-5xl space-y-6">
      {/* Back button & Title */}
      <div className="space-y-2">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Назад в админ-панель</span>
        </Link>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
          <AlertTriangle className="w-7 h-7 text-rose-500" />
          <span>Разрешение споров по счёту</span>
        </h1>
        <p className="text-xs md:text-sm text-muted-foreground">
          Список матчей с расхождениями в счёте между капитанами команд
        </p>
      </div>

      {loading ? (
        <div className="py-20 text-center text-muted-foreground animate-pulse text-sm">
          Загрузка споров...
        </div>
      ) : disputes.length === 0 ? (
        <Card className="border-neutral-800 bg-neutral-900/40 py-16 text-center">
          <ShieldCheck className="w-12 h-12 text-white mx-auto mb-3" />
          <p className="text-foreground font-bold">Активных споров нет</p>
          <p className="text-xs text-muted-foreground mt-1">Все матчи подтверждены или завершены без разногласий.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {disputes.map((match) => (
            <Card key={match.id} className="border-neutral-800 bg-neutral-900/80 backdrop-blur shadow-xl">
              <CardHeader className="pb-3 border-b border-neutral-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive">Диспут</Badge>
                    <span className="font-mono text-xs font-bold text-muted-foreground">
                      Матч #{match.id.slice(-6)} ({match.format})
                    </span>
                  </div>
                  <Link href={`/lobby/${match.id}`}>
                    <Button variant="outline" size="sm" className="h-7 text-xs border-neutral-700">
                      Лобби матча
                    </Button>
                  </Link>
                </div>
                <CardTitle className="text-base font-bold text-foreground mt-2">
                  [{match.teamA.tag}] {match.teamA.name} vs [{match.teamB.tag}] {match.teamB.name}
                </CardTitle>
              </CardHeader>

              <CardContent className="pt-4 space-y-4">
                {msg?.matchId === match.id && (
                  <div
                    className={`p-3 text-xs rounded-md ${
                      msg.type === 'success'
                        ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-500/15 border border-rose-500/40 text-rose-300'
                    }`}
                  >
                    {msg.text}
                  </div>
                )}

                {/* Score differences comparison table */}
                <div className="border border-border/60 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border/60 text-muted-foreground font-mono">
                        <th className="py-2.5 px-3 text-left">Карта</th>
                        <th className="py-2.5 px-3 text-center">Версия [{match.teamA.tag}]</th>
                        <th className="py-2.5 px-3 text-center">Версия [{match.teamB.tag}]</th>
                        <th className="py-2.5 px-3 text-right">Судейский вердикт (Счёт)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-mono">
                      {match.maps.map((m) => (
                        <tr key={m.id} className="hover:bg-muted/10">
                          <td className="py-2.5 px-3 font-bold capitalize text-foreground">
                            {m.map}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {m.scoreA_byA !== null
                              ? `${m.scoreA_byA} : ${m.scoreB_byA}`
                              : 'Не введён'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {m.scoreA_byB !== null
                              ? `${m.scoreA_byB} : ${m.scoreB_byB}`
                              : 'Не введён'}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="inline-flex items-center gap-1.5 justify-end">
                              <Input
                                type="number"
                                min="0"
                                max="99"
                                value={scores[match.id]?.[m.id]?.a || ''}
                                onChange={(e) =>
                                  handleScoreChange(match.id, m.id, 'a', e.target.value)
                                }
                                className="w-12 h-7 text-center text-xs p-1 font-bold"
                              />
                              <span>:</span>
                              <Input
                                type="number"
                                min="0"
                                max="99"
                                value={scores[match.id]?.[m.id]?.b || ''}
                                onChange={(e) =>
                                  handleScoreChange(match.id, m.id, 'b', e.target.value)
                                }
                                className="w-12 h-7 text-center text-xs p-1 font-bold"
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Reason input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Судейский комментарий / Обоснование вердикта:
                  </label>
                  <Input
                    type="text"
                    placeholder="Например: Счёт подтвержден по скриншоту Team A с итоговым табло..."
                    value={reasons[match.id] || ''}
                    onChange={(e) =>
                      setReasons((prev) => ({ ...prev, [match.id]: e.target.value }))
                    }
                    className="text-xs h-9"
                  />
                </div>

                {/* Buttons */}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={resolvingId === match.id}
                    onClick={() => handleResolve(match.id, 'CANCEL')}
                    className="text-xs gap-1.5 h-8"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Аннулировать матч</span>
                  </Button>
                  <Button
                    size="sm"
                    disabled={resolvingId === match.id}
                    onClick={() => handleResolve(match.id, 'CONFIRM')}
                    variant="cs"
                    className="text-xs gap-1.5 h-8 font-bold"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Утвердить счёт</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
