/**
 * To'liq ism — backend User.get_full_name() bilan bir xil tartib: "Familiya Ism Otasining ismi".
 * Avval ba'zi sahifalar "Ism Familiya" ko'rsatardi (profil: "Muallif Demo", ro'yxatlar: "Demo Muallif").
 */
type NameParts = {
  first_name?: string | null;
  last_name?: string | null;
  patronymic?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

export function personFullName(person: NameParts | null | undefined, fallback = ''): string {
  if (!person) return fallback;
  const parts = [
    person.last_name ?? person.lastName,
    person.first_name ?? person.firstName,
    person.patronymic,
  ]
    .map((p) => (p || '').trim())
    .filter(Boolean);
  return parts.length ? parts.join(' ') : fallback;
}
