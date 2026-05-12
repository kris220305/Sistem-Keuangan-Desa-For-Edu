# Admin, Pagination, Cron, Audit (Convex)

Dokumen ini merangkum perubahan API Convex terkait admin, paginasi sessions, cron cleanup, audit log, dan impersonation backup.

## Environment Variables (Convex Dashboard)

- `ADMIN_PASSWORD`: password admin (hanya dibaca di backend Convex).
- `CRON_SECRET`: secret untuk menjalankan job cleanup via cron.
- `IMPERSONATION_ENCRYPTION_KEY`: kunci enkripsi AES-256-GCM 32 bytes (hex 64 char atau base64) untuk backup/history impersonation.

## Catatan Migrasi

- `groupMembers.permissions` bersifat optional untuk kompatibilitas data lama. Member lama dianggap tetap boleh menulis jika field ini belum ada.
- `groups.currentLeaderId` akan terisi otomatis saat join/leave berikutnya (tidak membutuhkan migrasi manual).

## Admin Auth

- `admin.login({ password }) -> { token, expiresAt }`
  - Token disimpan di `sessionStorage.siskeudes_admin_token`.
- `admin.validate({ adminToken }) -> boolean`

Semua endpoint admin berikut membutuhkan `adminToken` valid:
- `sessions.listActive`
- `sessions.listAll`
- `sessions.remove`

## Sessions Pagination

- `sessions.listAll({ adminToken, limit?, paginationToken? }) -> { items, paginationToken, done }`
  - `limit` maksimal 50 per request. Jika >50, backend melempar error `Limit maksimal 50`.
  - `paginationToken` dipakai untuk memuat halaman berikutnya.

## Cron Cleanup Sessions

- Jadwal: setiap hari pukul **02:00 UTC**.
- Kriteria: menghapus `userSessions` dengan `lastActive` lebih lama dari **7 hari**.
- Monitoring: hasil run dicatat ke tabel `cronRuns`.

## Audit Log

Perubahan penting dicatat ke tabel `auditLog`, minimal untuk:
- `groups` (memberCount, currentLeaderId, add/remove member)
- `groupStates` (hash state)
- `sessions.remove`
- `admin.login`

## Impersonation Backup (Encrypted)

- Backup snapshot admin disimpan di Convex (tabel `impersonationBackups`) dengan enkripsi AES-256-GCM.
- History event start/stop dicatat ke `impersonationHistory` (juga terenkripsi payload-nya).

API:
- `impersonation.saveBackup({ adminToken, snapshot })`
- `impersonation.getBackup({ adminToken })`
- `impersonation.clearBackup({ adminToken })`
- `impersonation.recordEvent({ adminToken, targetSessionId, actionType, payload })`
