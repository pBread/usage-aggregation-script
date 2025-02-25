import { createObjectCsvWriter } from "csv-writer";
import "dotenv/config";
import fs from "fs";
import path from "path";
import twilio from "twilio";

async function main() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID_1;
  const authToken = process.env.TWILIO_AUTH_TOKEN_1;
  const client = twilio(accountSid, authToken);

  // Check if local directory exists and create it if it doesn't
  const localDir = path.join(process.cwd(), "local");
  if (!fs.existsSync(localDir)) {
    console.log("Creating local/ directory...");
    fs.mkdirSync(localDir, { recursive: true });
  }

  const outputPath = path.join(localDir, `${accountSid}.csv`);

  await aggregateUsageToCSV(client, outputPath);
}

async function aggregateUsageToCSV(client, outputPath) {
  console.log(`Will write data to: ${outputPath}`);

  // Define the CSV writer with headers
  const csvWriter = createObjectCsvWriter({
    path: outputPath,
    header: [
      { id: "accountSid", title: "Account SID" },
      { id: "category", title: "Category" },
      { id: "description", title: "Description" },
      { id: "startDate", title: "Start Date" },
      { id: "endDate", title: "End Date" },
      { id: "count", title: "Count" },
      { id: "countUnit", title: "Count Unit" },
      { id: "usage", title: "Usage" },
      { id: "usageUnit", title: "Usage Unit" },
      { id: "price", title: "Price" },
      { id: "priceUnit", title: "Price Unit" },
    ],
    append: false, // Start with a new file
  });

  // Track the current month to detect changes
  let currentMonth = null;
  let currentYear = null;
  let monthlyRecords = [];
  let totalRecords = 0;

  // Create headers first
  await csvWriter.writeRecords([]);

  // Now switch to append mode for subsequent writes
  csvWriter.options.append = true;

  console.log("Fetching usage records...");

  await client.usage.records.monthly.each(async (item) => {
    // Format dates to YYYY-MM-DD
    const startDate = formatDate(item.startDate);
    const endDate = formatDate(item.endDate);

    // Extract month and year from startDate
    const date = new Date(item.startDate);
    const month = date.getMonth();
    const year = date.getFullYear();

    // Check if we've moved to a new month
    if (
      currentMonth !== null &&
      (currentMonth !== month || currentYear !== year)
    ) {
      // Write the current month's records
      await csvWriter.writeRecords(monthlyRecords);
      console.log(
        `Wrote ${monthlyRecords.length} records for ${currentYear}-${(
          currentMonth + 1
        )
          .toString()
          .padStart(2, "0")}`,
      );

      // Clear the array for the new month
      totalRecords += monthlyRecords.length;
      monthlyRecords = [];
    }

    // Update current month/year
    currentMonth = month;
    currentYear = year;

    // Create a record object with the desired fields
    const record = {
      accountSid: item.accountSid,
      category: item.category,
      description: item.description,
      startDate: startDate,
      endDate: endDate,
      count: item.count,
      countUnit: item.countUnit,
      usage: item.usage,
      usageUnit: item.usageUnit,
      price: item.price,
      priceUnit: item.priceUnit,
    };

    // Add to current month's records
    monthlyRecords.push(record);
  });

  // Write any remaining records from the last month
  if (monthlyRecords.length > 0) {
    await csvWriter.writeRecords(monthlyRecords);
    console.log(
      `Wrote ${monthlyRecords.length} records for ${currentYear}-${(
        currentMonth + 1
      )
        .toString()
        .padStart(2, "0")}`,
    );
    totalRecords += monthlyRecords.length;
  }

  console.log(
    `Successfully wrote a total of ${totalRecords} records to ${outputPath}`,
  );
  return totalRecords;
}

/**
 * Formats a date object to YYYY-MM-DD string
 * @param {Date} date - Date object to format
 * @returns {string} Formatted date string
 */
function formatDate(date) {
  const d = new Date(date);
  return d.toISOString().split("T")[0]; // Returns YYYY-MM-DD
}

// Run the main function
main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
