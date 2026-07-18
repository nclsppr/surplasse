/* tslint:disable */
/* eslint-disable */
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
