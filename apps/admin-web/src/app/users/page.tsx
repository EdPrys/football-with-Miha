'use client';

import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { RequireAdmin } from '@/components/require-admin';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ROLE_LABEL: Record<string, string> = {
  PLAYER: 'Гравець',
  MANAGER: 'Менеджер',
  ADMIN: 'Адмін',
};

function UsersPageContent() {
  const utils = trpc.useUtils();
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const users = trpc.users.list.useQuery();

  const setRole = trpc.users.setRole.useMutation({
    onSuccess: () => {
      toast.success('Роль оновлено');
      utils.users.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Користувачі</h1>
        <p className="text-sm text-muted-foreground">
          Ролі: гравець → менеджер (створює ігри) → адмін (+ керує каталогом і ролями).
        </p>
      </div>

      {users.isLoading && <Skeleton className="h-24 w-full rounded-xl" />}
      <div className="space-y-2">
        {users.data?.map((u) => {
          const self = u.id === me.data?.user.id;
          return (
            <Card key={u.id} className="flex flex-row items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {u.name} {self && <span className="text-muted-foreground">(ти)</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">{u.email}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Select
                  value={u.role}
                  onValueChange={(role) => role && setRole.mutate({ userId: u.id, role })}
                  disabled={self || setRole.isPending}
                >
                  <SelectTrigger className="h-8 w-36 text-xs">
                    <SelectValue>{(role: string) => ROLE_LABEL[role] ?? role}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PLAYER">Гравець</SelectItem>
                    <SelectItem value="MANAGER">Менеджер</SelectItem>
                    <SelectItem value="ADMIN">Адмін</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default function UsersPage() {
  return (
    <RequireAdmin>
      <UsersPageContent />
    </RequireAdmin>
  );
}
