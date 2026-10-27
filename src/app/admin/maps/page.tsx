'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MapPin, ArrowLeft, Plus, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';

interface MapItem {
  id: string;
  map: string;
  displayName: string;
  active: boolean;
  defaultPool: boolean;
  imageUrl?: string | null;
}

export default function AdminMapsPage() {
  const [maps, setMaps] = useState<MapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMapCode, setNewMapCode] = useState('');
  const [newMapName, setNewMapName] = useState('');
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const fetchMaps = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/maps');
      const data = await res.json();
      if (data.success) {
        setMaps(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaps();
  }, []);

  const handleToggle = async (map: MapItem) => {
    try {
      const res = await fetch('/api/admin/maps', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: map.id, active: !map.active }),
      });
      const data = await res.json();
      if (data.success) {
        setMaps((prev) =>
          prev.map((m) => (m.id === map.id ? { ...m, active: !map.active } : m))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddMap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMapCode.trim() || !newMapName.trim()) return;

    setAdding(true);
    setMsg(null);

    try {
      const res = await fetch('/api/admin/maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          map: newMapCode.trim().toLowerCase(),
          displayName: newMapName.trim(),
          active: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка добавления карты');
      }

      setNewMapCode('');
      setNewMapName('');
      setMsg(data.message);
      await fetchMaps();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Ошибка добавления');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="container py-8 max-w-4xl space-y-6">
      {/* Back and Title */}
      <div className="space-y-1">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Назад в админ-панель</span>
        </Link>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
          <MapPin className="w-7 h-7 text-white" />
          <span>Пул соревновательных карт</span>
        </h1>
        <p className="text-xs md:text-sm text-muted-foreground">
          Настройка активных карт для процесса вето (банов и пиков) в матчах CS2
        </p>
      </div>

      {/* Add New Map Form */}
      <Card className="border-neutral-800 bg-neutral-900/60">
        <CardHeader className="pb-3 border-b border-neutral-800">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Plus className="w-4 h-4 text-white" />
            <span>Добавить карту в ротацию</span>
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Добавление новой пользовательской или турнирной карты
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleAddMap} className="flex flex-col sm:flex-row items-center gap-3">
            <Input
              type="text"
              placeholder="Код карты (например: train)"
              value={newMapCode}
              onChange={(e) => setNewMapCode(e.target.value)}
              required
              className="text-xs h-9 bg-neutral-950 border-neutral-800"
            />
            <Input
              type="text"
              placeholder="Название (например: de_train)"
              value={newMapName}
              onChange={(e) => setNewMapName(e.target.value)}
              required
              className="text-xs h-9 bg-neutral-950 border-neutral-800"
            />
            <Button
              type="submit"
              disabled={adding}
              variant="cs"
              size="sm"
              className="text-xs h-9 px-4 whitespace-nowrap"
            >
              {adding ? 'Добавление...' : 'Добавить'}
            </Button>
          </form>
          {msg && <p className="text-xs text-white mt-2">{msg}</p>}
        </CardContent>
      </Card>

      {/* Maps List */}
      {loading ? (
        <div className="py-20 text-center text-muted-foreground animate-pulse text-sm">
          Загрузка пула карт...
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {maps.map((map) => (
            <Card
              key={map.id}
              className={`border transition-all ${
                map.active
                  ? 'border-white/30 bg-neutral-900/90 shadow-md'
                  : 'border-neutral-800/60 bg-neutral-950/40 opacity-60'
              }`}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-base font-extrabold capitalize text-foreground">
                    {map.displayName}
                  </p>
                  <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                    <span>код: {map.map}</span>
                    {map.defaultPool && (
                      <Badge variant="outline" className="text-[9px] border-neutral-700">
                        Default
                      </Badge>
                    )}
                  </div>
                </div>

                <Button
                  variant={map.active ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleToggle(map)}
                  className={`h-8 text-xs gap-1.5 ${
                    map.active
                      ? 'bg-white hover:bg-neutral-200 text-black font-bold'
                      : 'text-muted-foreground border-neutral-700'
                  }`}
                >
                  {map.active ? (
                    <>
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>В пуле</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Отключена</span>
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
