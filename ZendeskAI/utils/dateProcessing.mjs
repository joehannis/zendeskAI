export const getUtcStartOfDay = (dateString) => {
  if (!dateString) {
    return null;
  }
  const d = new Date(dateString);
  return new Date(
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
  );
};

export const getUtcEndOfDay = (dateString) => {
  if (!dateString) {
    return null;
  }
  const d = new Date(dateString);
  return new Date(
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
  );
};
