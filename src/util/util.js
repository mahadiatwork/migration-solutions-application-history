export const getDate = (dateStr) => {
  const date = new Date(dateStr);
  const formattedDate = date
    .toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
    .replace(",", "");

  const [datePart, timePart, ampm] = formattedDate.split(" ");
  return [datePart, timePart + " " + ampm];
};
