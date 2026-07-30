export interface GstDetails {
  legalName: string;
  tradeName?: string;
  status: string;
  taxpayerType: string;
  address: string;
  pincode?: string;
  state?: string;
}

/**
 * Fetches GST details from an API.
 * Currently using a mock implementation. To make it live, replace this with a real fetch call
 * to Razorpay GST API, ClearTax, or any RapidAPI GST provider.
 */
export async function fetchGstDetails(gstNumber: string): Promise<GstDetails> {
  // Validate basic GST format (15 characters)
  if (!gstNumber || gstNumber.length !== 15) {
    throw new Error("Invalid GST Number format. It should be 15 characters long.");
  }

  try {
    // Call our secure backend instead of RapidAPI directly
    const response = await fetch(`http://localhost:4000/api/gst/${gstNumber}`);

    if (!response.ok) {
      throw new Error("Failed to fetch from backend GST API");
    }

    const json = await response.json();
    const data = typeof json === 'string' ? JSON.parse(json) : json;

    if (!data.success || !data.data || data.data.length === 0) {
      throw new Error("Invalid GST Number or details not found.");
    }

    const info = data.data[0];
    const addr = info.principalAddress?.address || {};
    
    // Combine address parts safely
    const addressParts = [addr.buildingName, addr.street, addr.location, addr.district].filter(Boolean);

    return {
      legalName: info.legalName || "",
      tradeName: info.tradeName || "",
      status: info.status || "",
      taxpayerType: info.taxType || "",
      address: addressParts.join(", "),
      pincode: addr.pincode || "",
      state: addr.stateCode || ""
    };
  } catch (error: any) {
    throw new Error(error.message || "Something went wrong while fetching GST details.");
  }
}
