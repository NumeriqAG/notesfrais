#!/usr/bin/env bash
# =====================================================================
# NotesFrais — que voit un visiteur NON authentifie ?
#
#   bash tools/probe-anon.sh
#
# Complement empirique de tools/audit-rls.sql : le SQL dit ce que la base
# declare, ce script dit ce qu'elle repond vraiment. A lancer depuis une
# machine ayant acces a internet.
#
# LECTURE SEULE — aucune requete de ce script n'ecrit quoi que ce soit.
#
# L'URL et la cle anon sont lues dans app.html. La cle anon est publique par
# conception : elle est livree a chaque visiteur. Toute la securite repose
# sur les RLS, et c'est exactement ce qu'on verifie ici.
# =====================================================================
set -uo pipefail
cd "$(dirname "$0")/.."

URL=$(grep -o "const SUPABASE_URL='[^']*'" app.html | cut -d"'" -f2)
KEY=$(grep -o "const SUPABASE_KEY='[^']*'" app.html | cut -d"'" -f2)
[ -z "$URL" ] && { echo "URL Supabase introuvable dans app.html"; exit 2; }

echo "Cible : $URL"
echo "Role  : anon (non authentifie)"
echo

fail=0

probe() {
  local label="$1" path="$2"
  local body code
  body=$(curl -sS --max-time 25 -w $'\n%{http_code}' \
    "$URL/rest/v1/$path" \
    -H "apikey: $KEY" -H "Authorization: Bearer $KEY" 2>&1)
  code=$(printf '%s' "$body" | tail -1)
  body=$(printf '%s' "$body" | sed '$d')

  printf '%-34s HTTP %s\n' "$label" "$code"
  case "$code" in
    200)
      if [ "$body" = "[]" ]; then
        echo "   OK — 0 ligne renvoyee, les RLS filtrent bien"
      else
        echo "   DANGER — des donnees sortent sans authentification :"
        printf '   %s\n' "$(printf '%s' "$body" | head -c 400)"
        fail=1
      fi
      ;;
    401|403)
      echo "   OK — acces refuse"
      ;;
    000)
      echo "   Injoignable (reseau ou proxy). Test non concluant."
      ;;
    *)
      echo "   Reponse inattendue :"
      printf '   %s\n' "$(printf '%s' "$body" | head -c 300)"
      ;;
  esac
  echo
}

probe "Table expenses"     "expenses?select=id,merchant,amount_chf&limit=5"
probe "Table app_profiles" "app_profiles?select=user_id,role,app_channel&limit=5"

if [ "$fail" -eq 0 ]; then
  echo "Resultat : aucune fuite detectee en lecture anonyme."
  echo "Lancer aussi tools/audit-rls.sql pour les droits d'ecriture et le bucket."
else
  echo "Resultat : FUITE CONFIRMEE. Appliquer supabase-auth-rls.sql sans attendre."
fi
exit "$fail"
