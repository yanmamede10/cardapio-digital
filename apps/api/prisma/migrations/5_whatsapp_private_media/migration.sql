-- WhatsApp media moved to a private bucket: the row keeps the object key, never a URL (the API signs one per read).
-- No data to convert: the only database that ever held WhatsApp media was emptied after the real-number test.
ALTER TABLE "SupportMessage" RENAME COLUMN "mediaUrl" TO "mediaKey";
