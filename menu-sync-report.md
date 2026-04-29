# Rapport menu sync — Pro → Client

Date : 2026-04-29T13:21:39.782Z
Durée : 8.6s
Endpoint : https://nyama-api-production.up.railway.app/api/v1

## Bilan : 11 ✅ / 0 ❌

## Étapes

- ✅ **Login Fabrice + Catherine**
- ✅ **Sockets connectés**
- ✅ **IA /ai/menu/suggest OK** — name="Okok aux feuilles de gnetum" price=2000fcfa allergens=[arachide] match=okok
- ✅ **Catherine POST /cook/menu-items** — id=aa822280-f82c-4021-8912-3ba2ccbf69f8 isAvailable=true
- ✅ **Fabrice reçoit menu:updated (created) en broadcast** — cookId=cp-catherine action=created
- ✅ **Plat visible dans GET /cooks/.../menu-items côté Client** — name="Okok aux feuilles de gnetum — TEST E2E 1777468892947"
- ✅ **Catherine PATCH menu-items/:id { isAvailable: false } (fallback)**
- ✅ **Plat masqué après désactivation (filter défaut)** — correctement filtré
- ✅ **?includeUnavailable=true renvoie le plat désactivé** — isAvailable=false
- ✅ **Cleanup DELETE plat de test**
- ✅ **Fabrice reçoit menu:updated (deleted/updated) après cleanup** — action=updated

## Events menu:updated (6)

```
[13:21:33] COOK action=created cookId=cp-catherine dishId=aa822280-f82c-4021-8912-3ba2ccbf69f8
[13:21:33] CLIENT action=created cookId=cp-catherine dishId=aa822280-f82c-4021-8912-3ba2ccbf69f8
[13:21:36] COOK action=updated cookId=cp-catherine dishId=aa822280-f82c-4021-8912-3ba2ccbf69f8
[13:21:36] CLIENT action=updated cookId=cp-catherine dishId=aa822280-f82c-4021-8912-3ba2ccbf69f8
[13:21:38] COOK action=deleted cookId=cp-catherine dishId=aa822280-f82c-4021-8912-3ba2ccbf69f8
[13:21:38] CLIENT action=deleted cookId=cp-catherine dishId=aa822280-f82c-4021-8912-3ba2ccbf69f8
```

**🟢 SYNC PRO→CLIENT 100% VALIDÉE**