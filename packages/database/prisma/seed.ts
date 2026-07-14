import "dotenv/config";
import { prisma } from "../src/client.js";

async function main() {
  const institute1 = await prisma.institute.upsert({
    where: { code: "INST-DEL-001" },
    update: {},
    create: { name: "Delhi Skill Development Institute", code: "INST-DEL-001", state: "Delhi" },
  });

  const institute2 = await prisma.institute.upsert({
    where: { code: "INST-MUM-001" },
    update: {},
    create: { name: "Mumbai Vocational Training Center", code: "INST-MUM-001", state: "Maharashtra" },
  });

  await prisma.qualification.upsert({
    where: { code: "QF102" },
    update: {},
    create: { code: "QF102", title: "Assistant Electrician", nsqfLevel: 3, credits: 24 },
  });

  await prisma.qualification.upsert({
    where: { code: "QF210" },
    update: {},
    create: { code: "QF210", title: "Junior Software Developer", nsqfLevel: 4, credits: 36 },
  });

  await prisma.student.upsert({
    where: { email: "asha.verma@example.com" },
    update: {},
    create: { fullName: "Asha Verma", email: "asha.verma@example.com", phone: "9999900001", instituteId: institute1.id },
  });

  await prisma.student.upsert({
    where: { email: "ravi.kumar@example.com" },
    update: {},
    create: { fullName: "Ravi Kumar", email: "ravi.kumar@example.com", phone: "9999900002", instituteId: institute1.id },
  });

  await prisma.student.upsert({
    where: { email: "priya.singh@example.com" },
    update: {},
    create: { fullName: "Priya Singh", email: "priya.singh@example.com", phone: "9999900003", instituteId: institute2.id },
  });

  console.log("Seed complete:", { institute1: institute1.id, institute2: institute2.id });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
