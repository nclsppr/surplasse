/* tslint:disable */
/* eslint-disable */
/**
 * An operational order displayed to the establishment staff. The customer tracking capability is deliberately omitted.
 * 
 * @export
 * @interface DashboardOrder
 */
export interface DashboardOrder {
    /**
     * Identifier of the order.
     * @type {string}
     * @memberof DashboardOrder
     */
    id: string;
    /**
     * Short number displayed to the customer and staff.
     * @type {string}
     * @memberof DashboardOrder
     */
    displayNumber: string;
    /**
     * Current operational status of the order.
     * @type {string}
     * @memberof DashboardOrder
     */
    status: DashboardOrderStatusEnum;
    /**
     * Type of the order.
     * @type {string}
     * @memberof DashboardOrder
     */
    type: DashboardOrderTypeEnum;
    /**
     * Label of the table. Absent for takeaway.
     * @type {string}
     * @memberof DashboardOrder
     */
    tableLabel?: string;
    /**
     * Lines frozen when the order was created.
     * @type {Array<OrderLine>}
     * @memberof DashboardOrder
     */
    lines: Array<OrderLine>;
    /**
     * Total amount in cents.
     * @type {number}
     * @memberof DashboardOrder
     */
    totalCents: number;
    /**
     * ISO 4217 currency code.
     * @type {string}
     * @memberof DashboardOrder
     */
    currency: string;
    /**
     * Creation timestamp in UTC.
     * @type {string}
     * @memberof DashboardOrder
     */
    createdAt: string;
}


/**
 * @export
 */
export const DashboardOrderStatusEnum = {
    Paid: 'paid',
    Accepted: 'accepted',
    Preparing: 'preparing',
    Ready: 'ready'
} as const;
export type DashboardOrderStatusEnum = typeof DashboardOrderStatusEnum[keyof typeof DashboardOrderStatusEnum];

/**
 * @export
 */
export const DashboardOrderTypeEnum = {
    OnSite: 'on_site',
    Takeaway: 'takeaway'
} as const;
export type DashboardOrderTypeEnum = typeof DashboardOrderTypeEnum[keyof typeof DashboardOrderTypeEnum];

/**
 * Public profile of an establishment, rendered on its mini-site.
 * @export
 * @interface EstablishmentPublic
 */
export interface EstablishmentPublic {
    /**
     * Identifier of the establishment.
     * @type {string}
     * @memberof EstablishmentPublic
     */
    id: string;
    /**
     * Display name of the establishment.
     * @type {string}
     * @memberof EstablishmentPublic
     */
    name: string;
    /**
     * Slug of the establishment, label of its subdomain.
     * @type {string}
     * @memberof EstablishmentPublic
     */
    slug: string;
    /**
     * Postal address, displayed on the mini-site. Absent when not provided.
     * @type {string}
     * @memberof EstablishmentPublic
     */
    address?: string;
}
/**
 * The opaque single-use token carried by the magic link.
 * @export
 * @interface MagicLinkExchange
 */
export interface MagicLinkExchange {
    /**
     * Opaque URL-safe token posted by the intermediate landing page.
     * @type {string}
     * @memberof MagicLinkExchange
     */
    token: string;
}
/**
 * The restaurateur email that should receive a login link.
 * @export
 * @interface MagicLinkRequest
 */
export interface MagicLinkRequest {
    /**
     * Email normalized case-insensitively by the server.
     * @type {string}
     * @memberof MagicLinkRequest
     */
    email: string;
}
/**
 * A section of the menu (starters, mains, drinks).
 * @export
 * @interface MenuCategory
 */
export interface MenuCategory {
    /**
     * Identifier of the category.
     * @type {string}
     * @memberof MenuCategory
     */
    id: string;
    /**
     * Display name of the category.
     * @type {string}
     * @memberof MenuCategory
     */
    name: string;
    /**
     * Products of the category, in display order.
     * @type {Array<MenuProduct>}
     * @memberof MenuCategory
     */
    products: Array<MenuProduct>;
}
/**
 * A variant or extra inside an option group.
 * @export
 * @interface MenuOption
 */
export interface MenuOption {
    /**
     * Identifier of the option.
     * @type {string}
     * @memberof MenuOption
     */
    id: string;
    /**
     * Display name of the option.
     * @type {string}
     * @memberof MenuOption
     */
    name: string;
    /**
     * Extra cost of the option, in cents. Zero for free variants.
     * @type {number}
     * @memberof MenuOption
     */
    extraCostCents: number;
    /**
     * Whether the option can currently be picked.
     * @type {boolean}
     * @memberof MenuOption
     */
    available: boolean;
}
/**
 * A set of options of a product (doneness, size, extras) with its choice rules. `minChoices` of 1 or more makes the group mandatory.
 * 
 * @export
 * @interface MenuOptionGroup
 */
export interface MenuOptionGroup {
    /**
     * Identifier of the option group.
     * @type {string}
     * @memberof MenuOptionGroup
     */
    id: string;
    /**
     * Display name of the group.
     * @type {string}
     * @memberof MenuOptionGroup
     */
    name: string;
    /**
     * Minimum number of options to pick in the group.
     * @type {number}
     * @memberof MenuOptionGroup
     */
    minChoices: number;
    /**
     * Maximum number of options to pick in the group. Always greater than or equal to `minChoices`.
     * @type {number}
     * @memberof MenuOptionGroup
     */
    maxChoices: number;
    /**
     * Options of the group, in display order.
     * @type {Array<MenuOption>}
     * @memberof MenuOptionGroup
     */
    options: Array<MenuOption>;
}
/**
 * A product as displayed on the menu. Unavailable products are included with `available: false` so the frontend renders them greyed out.
 * 
 * @export
 * @interface MenuProduct
 */
export interface MenuProduct {
    /**
     * Identifier of the product.
     * @type {string}
     * @memberof MenuProduct
     */
    id: string;
    /**
     * Display name of the product.
     * @type {string}
     * @memberof MenuProduct
     */
    name: string;
    /**
     * Short description of the product. Absent when not provided.
     * @type {string}
     * @memberof MenuProduct
     */
    description?: string;
    /**
     * Base price of the product, in cents.
     * @type {number}
     * @memberof MenuProduct
     */
    priceCents: number;
    /**
     * Whether the product can currently be ordered.
     * @type {boolean}
     * @memberof MenuProduct
     */
    available: boolean;
    /**
     * Option groups of the product, in display order. Empty when the product has no options.
     * @type {Array<MenuOptionGroup>}
     * @memberof MenuProduct
     */
    optionGroups: Array<MenuOptionGroup>;
}
/**
 * An order as seen by the customer: lines frozen at creation (names, prices and options copied from the catalog at that instant), status driven by the kitchen.
 * 
 * @export
 * @interface Order
 */
export interface Order {
    /**
     * Identifier of the order.
     * @type {string}
     * @memberof Order
     */
    id: string;
    /**
     * Short number displayed to the customer and the staff, unique per establishment and day.
     * @type {string}
     * @memberof Order
     */
    displayNumber: string;
    /**
     * Current status of the order.
     * @type {string}
     * @memberof Order
     */
    status: OrderStatusEnum;
    /**
     * Type of the order.
     * @type {string}
     * @memberof Order
     */
    type: OrderTypeEnum;
    /**
     * Label of the table for on-site orders. Absent for takeaway.
     * @type {string}
     * @memberof Order
     */
    tableLabel?: string;
    /**
     * Lines of the order, frozen at creation.
     * @type {Array<OrderLine>}
     * @memberof Order
     */
    lines: Array<OrderLine>;
    /**
     * Total of the order in cents, sum of the line totals.
     * @type {number}
     * @memberof Order
     */
    totalCents: number;
    /**
     * ISO 4217 currency code.
     * @type {string}
     * @memberof Order
     */
    currency: string;
    /**
     * Non-guessable capability giving access to the tracking page and stream.
     * @type {string}
     * @memberof Order
     */
    trackingToken: string;
    /**
     * Creation timestamp, ISO 8601 UTC.
     * @type {string}
     * @memberof Order
     */
    createdAt: string;
}


/**
 * @export
 */
export const OrderStatusEnum = {
    PendingPayment: 'pending_payment',
    Paid: 'paid',
    Accepted: 'accepted',
    Preparing: 'preparing',
    Ready: 'ready',
    Served: 'served',
    PickedUp: 'picked_up',
    Cancelled: 'cancelled',
    Refunded: 'refunded'
} as const;
export type OrderStatusEnum = typeof OrderStatusEnum[keyof typeof OrderStatusEnum];

/**
 * @export
 */
export const OrderTypeEnum = {
    OnSite: 'on_site',
    Takeaway: 'takeaway'
} as const;
export type OrderTypeEnum = typeof OrderTypeEnum[keyof typeof OrderTypeEnum];

/**
 * The validated cart sent by the Commande frontend. The establishment and the table come from the table session; amounts are recomputed server side from the catalog and never trusted from the client.
 * 
 * @export
 * @interface OrderCreationRequest
 */
export interface OrderCreationRequest {
    /**
     * Type of the order. Only `on_site` is accepted at this stage.
     * @type {string}
     * @memberof OrderCreationRequest
     */
    type: OrderCreationRequestTypeEnum;
    /**
     * Lines of the cart, one per product and option combination.
     * @type {Array<OrderLineRequest>}
     * @memberof OrderCreationRequest
     */
    lines: Array<OrderLineRequest>;
}


/**
 * @export
 */
export const OrderCreationRequestTypeEnum = {
    OnSite: 'on_site',
    Takeaway: 'takeaway'
} as const;
export type OrderCreationRequestTypeEnum = typeof OrderCreationRequestTypeEnum[keyof typeof OrderCreationRequestTypeEnum];

/**
 * A line of an order, snapshot of the product and options at creation time.
 * @export
 * @interface OrderLine
 */
export interface OrderLine {
    /**
     * Product reference; may point to a product later removed from the menu.
     * @type {string}
     * @memberof OrderLine
     */
    productId: string;
    /**
     * Name of the product, frozen at creation.
     * @type {string}
     * @memberof OrderLine
     */
    productName: string;
    /**
     * Unit price in cents, frozen at creation.
     * @type {number}
     * @memberof OrderLine
     */
    unitPriceCents: number;
    /**
     * Quantity ordered.
     * @type {number}
     * @memberof OrderLine
     */
    quantity: number;
    /**
     * Options picked for this line, snapshot with their labels and extra costs.
     * @type {Array<OrderLineOption>}
     * @memberof OrderLine
     */
    options: Array<OrderLineOption>;
    /**
     * Free note for the kitchen. Absent when not provided.
     * @type {string}
     * @memberof OrderLine
     */
    note?: string;
    /**
     * (unit price + extra costs) x quantity, in cents.
     * @type {number}
     * @memberof OrderLine
     */
    lineTotalCents: number;
}
/**
 * An option picked on a line, snapshot at creation time.
 * @export
 * @interface OrderLineOption
 */
export interface OrderLineOption {
    /**
     * Name of the option group, frozen at creation.
     * @type {string}
     * @memberof OrderLineOption
     */
    group: string;
    /**
     * Name of the option, frozen at creation.
     * @type {string}
     * @memberof OrderLineOption
     */
    option: string;
    /**
     * Extra cost of the option in cents, frozen at creation.
     * @type {number}
     * @memberof OrderLineOption
     */
    extraCostCents: number;
}
/**
 * One line of the validated cart.
 * @export
 * @interface OrderLineRequest
 */
export interface OrderLineRequest {
    /**
     * Product being ordered.
     * @type {string}
     * @memberof OrderLineRequest
     */
    productId: string;
    /**
     * Quantity ordered.
     * @type {number}
     * @memberof OrderLineRequest
     */
    quantity: number;
    /**
     * Options picked for this line, one entry per picked option, all groups rules enforced server side.
     * @type {Array<string>}
     * @memberof OrderLineRequest
     */
    optionIds?: Array<string>;
    /**
     * Free note for the kitchen, passed along verbatim.
     * @type {string}
     * @memberof OrderLineRequest
     */
    note?: string;
}
/**
 * One cursor-paginated page of operational orders, newest first. nextCursor is present exactly when hasMore is true.
 * 
 * @export
 * @interface OrderPage
 */
export interface OrderPage {
    /**
     * Operational orders in this page.
     * @type {Array<DashboardOrder>}
     * @memberof OrderPage
     */
    items: Array<DashboardOrder>;
    /**
     * Opaque cursor to request the following page.
     * @type {string}
     * @memberof OrderPage
     */
    nextCursor?: string;
    /**
     * Whether another page exists.
     * @type {boolean}
     * @memberof OrderPage
     */
    hasMore: boolean;
}
/**
 * The order to open a Stripe payment session for.
 * @export
 * @interface PaymentCreationRequest
 */
export interface PaymentCreationRequest {
    /**
     * Order to pay, at status pending_payment, inside the caller's table session.
     * @type {string}
     * @memberof PaymentCreationRequest
     */
    orderId: string;
}
/**
 * A Stripe payment session for one order. The client secret feeds the Payment Element; the amount is recomputed server side.
 * 
 * @export
 * @interface PaymentSession
 */
export interface PaymentSession {
    /**
     * Identifier of the payment attempt.
     * @type {string}
     * @memberof PaymentSession
     */
    id: string;
    /**
     * Order being paid.
     * @type {string}
     * @memberof PaymentSession
     */
    orderId: string;
    /**
     * Amount to pay in cents, recomputed server side.
     * @type {number}
     * @memberof PaymentSession
     */
    amountCents: number;
    /**
     * ISO 4217 currency code.
     * @type {string}
     * @memberof PaymentSession
     */
    currency: string;
    /**
     * Stripe PaymentIntent client secret, consumed by the Payment Element.
     * @type {string}
     * @memberof PaymentSession
     */
    clientSecret: string;
}
/**
 * RFC 9457 Problem Details document, the single error format of the API. The `type` URI is stable and identifies the applicative error.
 * 
 * @export
 * @interface Problem
 */
export interface Problem {
    /**
     * Stable URI identifying the applicative error type.
     * @type {string}
     * @memberof Problem
     */
    type?: string;
    /**
     * Short, human-readable summary of the error type.
     * @type {string}
     * @memberof Problem
     */
    title: string;
    /**
     * HTTP status code of this occurrence.
     * @type {number}
     * @memberof Problem
     */
    status: number;
    /**
     * Human-readable explanation specific to this occurrence.
     * @type {string}
     * @memberof Problem
     */
    detail?: string;
    /**
     * URI reference of the request that produced the error.
     * @type {string}
     * @memberof Problem
     */
    instance?: string;
}
/**
 * The published menu of an establishment, as a complete read model in display order. Array order is the display order.
 * 
 * @export
 * @interface PublicMenu
 */
export interface PublicMenu {
    /**
     * Identifier of the menu.
     * @type {string}
     * @memberof PublicMenu
     */
    id: string;
    /**
     * Name of the menu, chosen by the restaurateur.
     * @type {string}
     * @memberof PublicMenu
     */
    name: string;
    /**
     * ISO 4217 currency code of every amount in the menu.
     * @type {string}
     * @memberof PublicMenu
     */
    currency: string;
    /**
     * Categories of the menu, in display order.
     * @type {Array<MenuCategory>}
     * @memberof PublicMenu
     */
    categories: Array<MenuCategory>;
}
/**
 * An establishment accessible to the authenticated restaurateur.
 * @export
 * @interface RestaurateurEstablishment
 */
export interface RestaurateurEstablishment {
    /**
     * Identifier used by authenticated Dashboard operations.
     * @type {string}
     * @memberof RestaurateurEstablishment
     */
    id: string;
    /**
     * Display name of the establishment.
     * @type {string}
     * @memberof RestaurateurEstablishment
     */
    name: string;
    /**
     * Subdomain label of the establishment mini-site.
     * @type {string}
     * @memberof RestaurateurEstablishment
     */
    slug: string;
}
/**
 * Minimal authenticated restaurateur view used to initialize the Dashboard. It contains no authorization token because credentials stay exclusively in HttpOnly cookies.
 * 
 * @export
 * @interface RestaurateurSession
 */
export interface RestaurateurSession {
    /**
     * Identifier of the authenticated restaurateur.
     * @type {string}
     * @memberof RestaurateurSession
     */
    id: string;
    /**
     * Restaurateur email used for magic-link authentication.
     * @type {string}
     * @memberof RestaurateurSession
     */
    email: string;
    /**
     * Name displayed in the Dashboard.
     * @type {string}
     * @memberof RestaurateurSession
     */
    fullName: string;
    /**
     * Establishments this restaurateur can access, sorted by name then identifier.
     * @type {Array<RestaurateurEstablishment>}
     * @memberof RestaurateurSession
     */
    establishments: Array<RestaurateurEstablishment>;
}
/**
 * An anonymous table session. The token is opaque (a server-side reference, not a JWT) and carries no personal data.
 * 
 * @export
 * @interface TableSession
 */
export interface TableSession {
    /**
     * Opaque session token, sent back in the X-Table-Session header.
     * @type {string}
     * @memberof TableSession
     */
    token: string;
    /**
     * Establishment the session is bound to.
     * @type {string}
     * @memberof TableSession
     */
    establishmentId: string;
    /**
     * Human label of the table, resolved server side from the scanned code.
     * @type {string}
     * @memberof TableSession
     */
    tableLabel: string;
    /**
     * Expiry of the session, sliding while the session is active.
     * @type {string}
     * @memberof TableSession
     */
    expiresAt: string;
}
/**
 * The context carried by a scanned table QR code.
 * @export
 * @interface TableSessionRequest
 */
export interface TableSessionRequest {
    /**
     * Slug of the establishment, from the mini-site subdomain.
     * @type {string}
     * @memberof TableSessionRequest
     */
    establishmentSlug: string;
    /**
     * Non-guessable table code carried by the QR URL, never a sequential number.
     * @type {string}
     * @memberof TableSessionRequest
     */
    tableCode: string;
}
