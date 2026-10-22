/** Bahasa Melayu phrases for this area of the app (see ./index.ts for the glossary). */
const dict: Record<string, string> = {
  // customer menu (/t/[slug]/[table])
  "{name} isn't taking QR orders right now.": "{name} tak terima pesanan QR buat masa ini.",
  "You're at {table}": "Anda di {table}",
  "Takeaway order": "Pesanan bungkus",
  "The menu is being updated. Please order at the counter.": "Menu sedang dikemas kini. Sila pesan di kaunter.",
  "View order ({n})": "Lihat pesanan ({n})",
  Less: "Kurang",
  More: "Tambah",
  ", up to {n}": ", maksimum {n}",
  "Note for the kitchen": "Nota untuk dapur",
  "e.g. no onion": "cth. tak nak bawang",
  "Choose {group}": "Pilih {group}",
  "Add · {price}": "Tambah · {price}",
  "Your order": "Pesanan anda",
  "Order type": "Jenis pesanan",
  "Your name (required)": "Nama anda (wajib)",
  "Your name (optional)": "Nama anda (pilihan)",
  "Phone (optional)": "Telefon (pilihan)",
  "Note for the whole order": "Nota untuk semua pesanan",
  "Sending to kitchen…": "Menghantar ke dapur…",
  "Send order to kitchen": "Hantar pesanan ke dapur",
  "Pay at the counter when you are done.": "Bayar di kaunter bila dah siap makan.",

  // order status (/o/[token])
  "Order #{n}": "Pesanan #{n}",
  "This order was cancelled by the kedai. Please check with the counter.":
    "Pesanan ini dibatalkan oleh kedai. Sila tanya di kaunter.",
  "Order progress": "Status pesanan",
  Received: "Diterima",
  "Charged to your company account.": "Dicaj ke akaun syarikat anda.",
  "Paid. Terima kasih!": "Dah bayar. Terima kasih!",
  "View receipt": "Lihat resit",
  "Please pay at the counter": "Sila bayar di kaunter",
  "Cash or DuitNow QR. Show order #{n} to the cashier.": "Tunai atau DuitNow QR. Tunjuk pesanan #{n} kepada juruwang.",
  "Keep this page open. It updates by itself.": "Biarkan halaman ini terbuka. Ia dikemas kini sendiri.",

  // receipt (/r/[token])
  "Receipt {shop} #{n}: {url}": "Resit {shop} #{n}: {url}",
  "Tel {phone}": "Tel {phone}",
  "Discount ({type})": "Diskaun ({type})",
  TOTAL: "JUMLAH",
  "Ref {ref}": "Rujukan {ref}",
  UNPAID: "BELUM BAYAR",

  // auth panel
  "Customers scan the QR and order right from the table": "Customer scan QR, terus order dari meja",
  "The kitchen sees the ticket instantly": "Dapur nampak tiket serta-merta",
  "Close the kedai with an accurate recon": "Tutup kedai dengan rekon yang tepat",

  // login
  "Owner, cashier or kitchen staff.": "Pemilik, juruwang atau staf dapur.",
  "New kedai?": "Kedai baru?",
  "Create an account": "Daftar akaun",
  "Logging in…": "Sedang log masuk…",
  "Your account was deactivated. Ask the owner to reactivate it.":
    "Akaun anda telah dinyahaktifkan. Minta pemilik aktifkan semula.",
  "This account has been deactivated. Ask the owner to reactivate it.":
    "Akaun ini telah dinyahaktifkan. Minta pemilik aktifkan semula.",
  "This kedai's subscription is suspended. Contact Rubix support.":
    "Langganan kedai ini telah digantung. Hubungi sokongan Rubix.",
  "Email or password is incorrect.": "Emel atau kata laluan salah.",

  // signup
  "Create account": "Daftar akaun",
  "Set up your kedai": "Sediakan kedai anda",
  "Takes a minute. You can change everything later.": "Sekejap je. Semua boleh ubah kemudian.",
  "Already have an account?": "Dah ada akaun?",
  "Kedai name": "Nama kedai",
  "Menu link name": "Nama pautan menu",
  "Customers' menu lives at {path}": "Menu pelanggan ada di {path}",
  "Your name": "Nama anda",
  "At least 8 characters": "Sekurang-kurangnya 8 aksara",
  "How many tables?": "Berapa meja?",
  "Each table gets its own QR code. Add more anytime.": "Setiap meja dapat kod QR sendiri. Boleh tambah bila-bila masa.",
  "Start with a sample mamak menu": "Mula dengan contoh menu mamak",
  "Creating…": "Sedang cipta…",
  "Create kedai": "Cipta kedai",
  "Sign-up is closed. Contact Rubix to get onboarded.": "Pendaftaran ditutup. Hubungi Rubix untuk mula guna.",
  'The link name "{slug}" is taken. Try another.': 'Nama pautan "{slug}" dah diambil. Cuba nama lain.',
  "An account with this email already exists. Log in instead.": "Akaun dengan emel ini sudah wujud. Sila log masuk.",
  "Enter the kedai name": "Masukkan nama kedai",
  "Link name needs at least 3 characters": "Nama pautan perlu sekurang-kurangnya 3 aksara",
  "Use lowercase letters, numbers and dashes only": "Guna huruf kecil, nombor dan sengkang sahaja",
  "Enter your name": "Masukkan nama anda",
  "Enter a valid email": "Masukkan emel yang sah",
  "Password needs at least 8 characters": "Kata laluan perlu sekurang-kurangnya 8 aksara",
};

export default dict;
