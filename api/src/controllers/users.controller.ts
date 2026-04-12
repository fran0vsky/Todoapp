import type { Request, Response } from 'express';
import { listUsersForPicker } from '../services/users.service';

export async function getUsers(_req: Request, res: Response): Promise<void> {
  const result = await listUsersForPicker();
  if (result.ok === false) {
    res.status(500).json({ error: result.message });
    return;
  }
  res.json({ users: result.users });
}
