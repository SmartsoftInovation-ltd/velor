export type PolicySection = { title: string; points: string[] };

// Standard terms for a shop delivering inside Bangladesh. The same for every store.

export const SHIPPING_POLICY: PolicySection[] = [
  {
    title: "Delivery areas",
    points: [
      "We deliver all over Bangladesh through our courier partners.",
      "Give a full address and an active phone number at checkout, so the rider can reach you.",
    ],
  },
  {
    title: "Delivery time",
    points: [
      "Inside Dhaka: 1 to 3 working days after the order is confirmed.",
      "Outside Dhaka: 3 to 5 working days after the order is confirmed.",
      "Public holidays, bad weather or a strike can add a day or two. We will call you if your parcel is late.",
    ],
  },
  {
    title: "Delivery charge",
    points: [
      "The charge depends on where the parcel goes and is shown at checkout before you place the order.",
      "No charge is added after the order is placed.",
    ],
  },
  {
    title: "Order confirmation and tracking",
    points: [
      "We may call or message you to confirm the order before it is packed.",
      "Follow your parcel any time on the Track Order page with your invoice number.",
    ],
  },
  {
    title: "Receiving your parcel",
    points: [
      "Check the parcel in front of the rider. If the product is damaged or not what you ordered, hand it back right away.",
      "If nobody can receive the parcel, the courier tries again. After repeated failed tries the order is cancelled.",
    ],
  },
];

export const RETURN_POLICY: PolicySection[] = [
  {
    title: "When you can return",
    points: [
      "Within 7 days of delivery.",
      "The product is damaged, defective, the wrong item, or the wrong size or colour.",
    ],
  },
  {
    title: "Condition of the product",
    points: [
      "Unused, unwashed and in its original packaging, with tags and any free gift.",
      "Keep the invoice. We need the invoice number to find your order.",
    ],
  },
  {
    title: "What cannot be returned",
    points: [
      "Products that were used, washed or damaged after delivery.",
      "Innerwear, cosmetics and personal care products once opened, for hygiene.",
      "Products sold as final sale or clearance.",
    ],
  },
  {
    title: "How to return",
    points: [
      "Contact us with your invoice number and a photo of the problem.",
      "Once we approve the return, send the product back or hand it to our courier.",
      "If the mistake was ours, the return delivery is free. For a change of mind, the delivery charge is yours.",
    ],
  },
  {
    title: "Exchange and refund",
    points: [
      "You can exchange for another size, colour or product of the same value, if it is in stock.",
      "A refund is paid within 7 working days after we receive and check the product, by the same method you paid with.",
      "Delivery charges are refunded only when the product was damaged or wrong.",
    ],
  },
];
