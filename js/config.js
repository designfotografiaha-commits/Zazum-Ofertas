// =====================================================================
//  CONFIGURAÇÃO DO SITE — edite apenas este arquivo
// =====================================================================

// 1) Firebase: Console do Firebase > Configurações do projeto > Seus apps > App da Web
//    (Enquanto apiKey começar com "COLE", o site roda em MODO DEMONSTRAÇÃO com produtos de exemplo.)
export const firebaseConfig = {
  apiKey: "AIzaSyAZBldGnWwhGEIjeFF6opuaFhyqMJf9WUw",
  authDomain: "zazum-22a34.firebaseapp.com",
  projectId: "zazum-22a34",
  storageBucket: "zazum-22a34.firebasestorage.app",
  messagingSenderId: "288401395354",
  appId: "1:288401395354:web:eeab21fb561c13ce335923"
};

// 2) Cloudinary (fotos e vídeos, plano gratuito)
//    cloudName: aparece no Dashboard do Cloudinary
//    uploadPreset: nome do "upload preset" do tipo UNSIGNED que você criar
export const cloudinaryConfig = {
  cloudName: "COLE_AQUI_SEU_CLOUD_NAME",
  uploadPreset: "zazum_unsigned",
  folder: "zazum"
};

// Login do painel: quem digita só "admin" entra como "admin@<este domínio>".
// Crie o usuário no Firebase Authentication exatamente com esse e-mail.
export const ADMIN_LOGIN_DOMAIN = "zazumofertas.com";

// 3) Dados institucionais (aparecem no rodapé)
export const SITE = {
  name: "Zazum Ofertas",
  slogan: "A gente garimpa. Você economiza.",
  whatsapp: "",            // ex.: "5571999999999" (só números)
  instagram: "",           // ex.: "zazumofertas"
  email: "",               // ex.: "contato@zazum.com.br"
  // Dias sem conferir o preço até o painel avisar que a oferta precisa de revisão
  reviewAfterDays: 3
};

export const isConfigured = !String(firebaseConfig.apiKey).startsWith("COLE");
export const cloudinaryReady = !String(cloudinaryConfig.cloudName).startsWith("COLE");
