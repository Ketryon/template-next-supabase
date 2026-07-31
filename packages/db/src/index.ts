import "server-only";

/**
 * The public API of the data layer.
 *
 * `userClient`, `serviceClient` and `Db` are deliberately absent, exactly as
 * `db` was absent from the MongoDB template's barrel. An app that needs a query
 * it cannot express with the functions below has to add one here — where it
 * lands in review, takes a `Session`, chooses a client deliberately, and gets an
 * index in the migration.
 *
 * `server-only` sits here rather than in the internal modules so that scripts
 * and tests can import those directly; every path an application can take still
 * crosses the guard.
 */

// Queries — the only way in.
export * from "./dal/orders";
export * from "./dal/users";
export * as adminOrders from "./dal/admin/orders";

// Validators and types the apps need at their own boundaries.
export {
  orderInput,
  orderItem,
  orderStatus,
  toOrderDTO,
  type OrderDTO,
  type OrderInput,
  type OrderItem,
  type OrderStatus,
} from "./schemas/order";
export { profileInput, type ProfileDTO, type ProfileInput } from "./schemas/user";

export type { Page, PageParams } from "./pagination";
export { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "./pagination";

export type { Role, Session } from "./session";
export {
  DbError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "./errors";
