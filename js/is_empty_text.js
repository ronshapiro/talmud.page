const isEmptyText = (stringOrList) => {
  return !stringOrList || stringOrList === "" || stringOrList.length === 0;
};

export default isEmptyText;
