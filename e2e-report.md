# Rapport E2E NYAMA — parcours Client complet

Date : 2026-04-29T13:16:28.957Z
Durée : 19.3s
Endpoint : https://nyama-api-production.up.railway.app/api/v1
Order ID : 8f6f5b88-8365-4bc6-bd85-27d4926ac107

## Bilan : 21 ✅ / 0 ❌

## Étapes

- ✅ **Login 4 personas (admin/client/cook/rider)** — roles: ADMIN/CLIENT/COOK/RIDER
- ✅ **Rôles personas conformes au seed**
- ✅ **4 sockets connectés** — ids=D-TsfLtmO0A7gstkAAK-,szdjg55gbH6K8CnwAALB,QGEtnPSrbs6kPL-5AAK_,urBly42K114jgWDQAALA
- ✅ **Menu Catherine récupéré** — 8 plats, choix: "Ndolé complet" (2500fcfa)
- ✅ **Commande créée** — id=8f6f5b88-8365-4bc6-bd85-27d4926ac107 status=PENDING total=2500fcfa
- ✅ **Catherine reçoit order:new via socket** — payload OK
- ✅ **Catherine PATCH /cook/orders/:id/accept**
- ✅ **Catherine PATCH /cook/orders/:id/preparing**
- ✅ **Catherine PATCH /cook/orders/:id/ready**
- ✅ **Fabrice reçoit order:status READY** — status=READY
- ✅ **Kevin POST /rider/orders/:id/accept** — res={"id":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","clientId":"u-fabrice","cookId":"u-catherine","riderId":"u-kevin","status":
- ✅ **Kevin reçoit delivery:created** — deliveryId=78718208-731a-46ac-a6a6-76b991f2b23f
- ✅ **Kevin PATCH delivery → ARRIVED_RESTAURANT**
- ✅ **Kevin PATCH delivery → PICKED_UP**
- ✅ **Kevin PATCH delivery → ARRIVED_CLIENT**
- ✅ **Kevin PATCH delivery → DELIVERED**
- ✅ **Fabrice reçoit order:status DELIVERED** — status=DELIVERED
- ✅ **Catherine reçoit delivery:status (room order-X)**
- ✅ **Fabrice POST /orders/:id/rating** — ratingId=23905a40-df7d-4642-8de7-bf67a195c4a7
- ✅ **Note Catherine récupérée depuis /admin/live/map** — avgRating=4.8
- ✅ **GET /admin/live/overview OK** — todayRevenue=17500 todayOrdersCount=7

## Timeline events socket (166)

```
[13:16:10] COOK   ← connected {"userId":"u-catherine","role":"COOK"}
[13:16:10] ADMIN  ← connected {"userId":"u-admin","role":"ADMIN"}
[13:16:10] RIDER  ← connected {"userId":"u-kevin","role":"RIDER"}
[13:16:10] CLIENT ← connected {"userId":"u-fabrice","role":"CLIENT"}
[13:16:11] COOK   ← order:new {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","totalXaf":2500,"deliveryAddress":"Akwa I, Douala — Test E2E
[13:16:11] COOK   ← order:new {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","totalXaf":2500,"deliveryAddress":"Akwa I, Douala — Test E2E
[13:16:11] ADMIN  ← order:new {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","totalXaf":2500,"deliveryAddress":"Akwa I, Douala — Test E2E
[13:16:11] COOK   ← order:subscribed {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107"}
[13:16:11] CLIENT ← order:subscribed {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107"}
[13:16:14] COOK   ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"CONFIRMED"}
[13:16:14] CLIENT ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"CONFIRMED"}
[13:16:14] ADMIN  ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"CONFIRMED"}
[13:16:14] COOK   ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"CONFIRMED"}
[13:16:14] CLIENT ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"CONFIRMED"}
[13:16:14] ADMIN  ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"CONFIRMED"}
[13:16:14] COOK   ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"CONFIRMED"}
[13:16:14] CLIENT ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"CONFIRMED"}
[13:16:14] ADMIN  ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"CONFIRMED"}
[13:16:15] COOK   ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"PREPARING"}
[13:16:15] COOK   ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"PREPARING"}
[13:16:15] ADMIN  ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"PREPARING"}
[13:16:15] CLIENT ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"PREPARING"}
[13:16:15] ADMIN  ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"PREPARING"}
[13:16:15] CLIENT ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"PREPARING"}
[13:16:15] COOK   ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"PREPARING"}
[13:16:15] ADMIN  ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"PREPARING"}
[13:16:15] CLIENT ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"PREPARING"}
[13:16:16] COOK   ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"READY"}
[13:16:16] COOK   ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"READY"}
[13:16:16] COOK   ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"READY"}
[13:16:16] ADMIN  ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"READY"}
[13:16:16] ADMIN  ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"READY"}
[13:16:16] CLIENT ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"READY"}
[13:16:16] ADMIN  ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"READY"}
[13:16:16] CLIENT ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"READY"}
[13:16:16] ADMIN  ← order:ready {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","totalXaf":2500,"deliveryFeeXaf":800}
[13:16:16] CLIENT ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"READY"}
[13:16:17] COOK   ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"ASSIGNED","label":"En livraison"}
[13:16:17] COOK   ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"ASSIGNED","label":"En livraison"}
[13:16:17] COOK   ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"ASSIGNED","label":"En livraison"}
[13:16:17] ADMIN  ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"ASSIGNED","label":"En livraison"}
[13:16:17] COOK   ← order:assigned {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","rider":{"id":"u-kevin","name":"Kevin Tchiaze","phone":"+237
[13:16:17] CLIENT ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"ASSIGNED","label":"En livraison"}
[13:16:17] RIDER  ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"ASSIGNED","label":"En livraison","riderId":"u-kevi
[13:16:17] ADMIN  ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"ASSIGNED","label":"En livraison"}
[13:16:17] COOK   ← order:assigned {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","rider":{"id":"u-kevin","name":"Kevin Tchiaze","phone":"+237
[13:16:17] CLIENT ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"ASSIGNED","label":"En livraison","riderId":"u-kevi
[13:16:17] RIDER  ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"ASSIGNED","label":"En livraison","riderId":"u-kevi
[13:16:17] ADMIN  ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"ASSIGNED","label":"En livraison","riderId":"u-kevi
[13:16:17] CLIENT ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"ASSIGNED","label":"En livraison","riderId":"u-kevi
[13:16:17] RIDER  ← order:assigned {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","rider":{"id":"u-kevin","name":"Kevin Tchiaze","phone":"+237
[13:16:17] ADMIN  ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"ASSIGNED","label":"En livraison","riderId":"u-kevi
[13:16:17] RIDER  ← order:assigned {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","rider":{"id":"u-kevin","name":"Kevin Tchiaze","phone":"+237
[13:16:17] CLIENT ← order:assigned {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","riderId":"u-kevin","rider":{"id":"u-kevin","name":"Kevin Tc
[13:16:17] ADMIN  ← order:assigned {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","rider":{"id":"u-kevin","name":"Kevin Tchiaze","phone":"+237
[13:16:17] RIDER  ← delivery:created {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:17] CLIENT ← order:assigned {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","riderId":"u-kevin","rider":{"id":"u-kevin","name":"Kevin Tc
[13:16:17] ADMIN  ← order:assigned {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","riderId":"u-kevin","rider":{"id":"u-kevin","name":"Kevin Tc
[13:16:17] RIDER  ← delivery:created {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:17] ADMIN  ← order:assigned {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","rider":{"id":"u-kevin","name":"Kevin Tchiaze","phone":"+237
[13:16:17] ADMIN  ← delivery:created {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:18] RIDER  ← order:subscribed {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107"}
[13:16:21] COOK   ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:21] COOK   ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:21] RIDER  ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:21] COOK   ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:21] ADMIN  ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:21] CLIENT ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:21] RIDER  ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:21] COOK   ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"ASSIGNED","deliveryStatus":"ARRIVED_RESTAURANT","l
[13:16:21] ADMIN  ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:21] CLIENT ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:21] RIDER  ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:21] ADMIN  ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:21] COOK   ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"ASSIGNED","deliveryStatus":"ARRIVED_RESTAURANT","l
[13:16:21] CLIENT ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:21] RIDER  ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"ASSIGNED","deliveryStatus":"ARRIVED_RESTAURANT","l
[13:16:21] ADMIN  ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:21] COOK   ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"ASSIGNED","deliveryStatus":"ARRIVED_RESTAURANT","l
[13:16:21] RIDER  ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"ASSIGNED","deliveryStatus":"ARRIVED_RESTAURANT","l
[13:16:21] CLIENT ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"ASSIGNED","deliveryStatus":"ARRIVED_RESTAURANT","l
[13:16:21] ADMIN  ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"ASSIGNED","deliveryStatus":"ARRIVED_RESTAURANT","l
[13:16:21] RIDER  ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"ASSIGNED","deliveryStatus":"ARRIVED_RESTAURANT","l
[13:16:21] CLIENT ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"ASSIGNED","deliveryStatus":"ARRIVED_RESTAURANT","l
[13:16:21] ADMIN  ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"ASSIGNED","deliveryStatus":"ARRIVED_RESTAURANT","l
[13:16:21] CLIENT ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"ASSIGNED","deliveryStatus":"ARRIVED_RESTAURANT","l
[13:16:21] ADMIN  ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"ASSIGNED","deliveryStatus":"ARRIVED_RESTAURANT","l
[13:16:21] ADMIN  ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"ASSIGNED","deliveryStatus":"ARRIVED_RESTAURANT","l
[13:16:22] COOK   ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:22] ADMIN  ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:22] CLIENT ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:22] RIDER  ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:22] ADMIN  ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:22] COOK   ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:22] CLIENT ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:22] RIDER  ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:22] COOK   ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:22] ADMIN  ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:22] CLIENT ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:22] RIDER  ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:22] COOK   ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"PICKED_UP","deliveryStatus":"PICKED_UP","label":"C
[13:16:22] ADMIN  ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:22] CLIENT ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"PICKED_UP","deliveryStatus":"PICKED_UP","label":"C
[13:16:22] RIDER  ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"PICKED_UP","deliveryStatus":"PICKED_UP","label":"C
[13:16:22] COOK   ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"PICKED_UP","deliveryStatus":"PICKED_UP","label":"C
[13:16:22] ADMIN  ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"PICKED_UP","deliveryStatus":"PICKED_UP","label":"C
[13:16:22] CLIENT ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"PICKED_UP","deliveryStatus":"PICKED_UP","label":"C
[13:16:22] RIDER  ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"PICKED_UP","deliveryStatus":"PICKED_UP","label":"C
[13:16:22] COOK   ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"PICKED_UP","deliveryStatus":"PICKED_UP","label":"C
[13:16:22] ADMIN  ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"PICKED_UP","deliveryStatus":"PICKED_UP","label":"C
[13:16:22] CLIENT ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"PICKED_UP","deliveryStatus":"PICKED_UP","label":"C
[13:16:22] RIDER  ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"PICKED_UP","deliveryStatus":"PICKED_UP","label":"C
[13:16:22] ADMIN  ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"PICKED_UP","deliveryStatus":"PICKED_UP","label":"C
[13:16:22] ADMIN  ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"PICKED_UP","deliveryStatus":"PICKED_UP","label":"C
[13:16:23] COOK   ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:23] COOK   ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:23] ADMIN  ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:23] COOK   ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:23] ADMIN  ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:23] COOK   ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"PICKED_UP","deliveryStatus":"ARRIVED_CLIENT","labe
[13:16:23] ADMIN  ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:23] RIDER  ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:23] CLIENT ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:23] COOK   ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"PICKED_UP","deliveryStatus":"ARRIVED_CLIENT","labe
[13:16:23] ADMIN  ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:23] RIDER  ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:23] CLIENT ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:23] COOK   ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"PICKED_UP","deliveryStatus":"ARRIVED_CLIENT","labe
[13:16:23] ADMIN  ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"PICKED_UP","deliveryStatus":"ARRIVED_CLIENT","labe
[13:16:23] RIDER  ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:23] CLIENT ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:23] ADMIN  ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"PICKED_UP","deliveryStatus":"ARRIVED_CLIENT","labe
[13:16:23] RIDER  ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"PICKED_UP","deliveryStatus":"ARRIVED_CLIENT","labe
[13:16:23] CLIENT ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"PICKED_UP","deliveryStatus":"ARRIVED_CLIENT","labe
[13:16:23] ADMIN  ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"PICKED_UP","deliveryStatus":"ARRIVED_CLIENT","labe
[13:16:23] RIDER  ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"PICKED_UP","deliveryStatus":"ARRIVED_CLIENT","labe
[13:16:23] CLIENT ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"PICKED_UP","deliveryStatus":"ARRIVED_CLIENT","labe
[13:16:23] ADMIN  ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"PICKED_UP","deliveryStatus":"ARRIVED_CLIENT","labe
[13:16:23] RIDER  ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"PICKED_UP","deliveryStatus":"ARRIVED_CLIENT","labe
[13:16:23] CLIENT ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"PICKED_UP","deliveryStatus":"ARRIVED_CLIENT","labe
[13:16:24] COOK   ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:24] ADMIN  ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:24] COOK   ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:24] COOK   ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:24] ADMIN  ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:24] COOK   ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"DELIVERED","deliveryStatus":"DELIVERED","label":"L
[13:16:24] COOK   ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"DELIVERED","deliveryStatus":"DELIVERED","label":"L
[13:16:24] COOK   ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"DELIVERED","deliveryStatus":"DELIVERED","label":"L
[13:16:24] ADMIN  ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:24] RIDER  ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:24] CLIENT ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:24] ADMIN  ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:24] RIDER  ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:24] CLIENT ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:24] ADMIN  ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"DELIVERED","deliveryStatus":"DELIVERED","label":"L
[13:16:24] RIDER  ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:24] CLIENT ← delivery:status {"deliveryId":"78718208-731a-46ac-a6a6-76b991f2b23f","orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status"
[13:16:24] ADMIN  ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"DELIVERED","deliveryStatus":"DELIVERED","label":"L
[13:16:24] RIDER  ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"DELIVERED","deliveryStatus":"DELIVERED","label":"L
[13:16:24] CLIENT ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"DELIVERED","deliveryStatus":"DELIVERED","label":"L
[13:16:24] ADMIN  ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"DELIVERED","deliveryStatus":"DELIVERED","label":"L
[13:16:24] RIDER  ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"DELIVERED","deliveryStatus":"DELIVERED","label":"L
[13:16:24] CLIENT ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"DELIVERED","deliveryStatus":"DELIVERED","label":"L
[13:16:24] ADMIN  ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"DELIVERED","deliveryStatus":"DELIVERED","label":"L
[13:16:24] RIDER  ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"DELIVERED","deliveryStatus":"DELIVERED","label":"L
[13:16:24] CLIENT ← order:status {"orderId":"8f6f5b88-8365-4bc6-bd85-27d4926ac107","status":"DELIVERED","deliveryStatus":"DELIVERED","label":"L
```

## Verdict global

**🟢 PARCOURS CLIENT 100% VALIDÉ** — toutes les étapes et events critiques sont passés.