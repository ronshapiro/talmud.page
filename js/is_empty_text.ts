export default function isEmptyText(stringOrList: string | string[]): boolean {
  return !stringOrList || stringOrList === "" || stringOrList.length === 0;
}
