# Info pages and collection pages

## Routes

| Route | Content |
|---|---|
| `/shop/new-arrivals` | added in the last 7 days, else the latest (max 120) |
| `/shop/best-sellers` | most sold first, `sold > 0` only (max 120) |
| `/shop/offers` | the running flash sale (`GET /shop/flash-sale`) |
| `/shop/limited-offers` | the seller's picks (`GET /shop/limited-offers`) |
| `/about`, `/contact` | Store Information, via `getStore()` |
| `/shipping`, `/returns` | fixed copy in `src/lib/policies.ts` |

Collection pages share `CollectionPage`. Its list is `InfiniteList`: the server
renders every card, the client shows 12 and reveals 12 more near the end of the
list. The catalogue API has no paging, so nothing is fetched on scroll.

## Backend handoff: `GET /shop/store`

About and Contact read these optional fields of `Store` (`StoreContact` in
`src/lib/store-api.ts`). The endpoint sends only `storeName` and `image` today,
so both pages show "Contact details have not been added yet" until it adds:

| Response field | StoreInformation field |
|---|---|
| `slogan` | `propiterSlogan` |
| `businessType` | `businessType` |
| `address` | `adress` |
| `phone` | `phone` |
| `secondaryPhone` | `secondaryPhone` |
| `email` | `email` |
| `businessHours` | `businessHours` |
| `googleMapLink` | `googleMapLink` |
| `facebookLink` | `facebookLink` |
| `instagramLink` | `instagramLink` |
| `whatsappLink` | `whatsappLink` |
| `messengerLink` | `messengerLink` |

Empty or missing fields are left out of the page.

## Home page chat button

`ChatWidget` (home page only) reads the same response: `messengerLink`,
`whatsappLink` and `phone`. Each one that is set becomes a button; with none
set, or until the endpoint sends them, the chat button is not drawn at all. A
value that is not a URL is treated as a WhatsApp number or a Messenger page name.
